import sys
import os
import json
import csv
import math
import random
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request
import urllib.error

sys.path.insert(0, "/run/media/sushitrash26/New Volume/GENAI/17thOct/soundgraph")

from backend.core.neo4j_driver import Neo4jConnection
from backend.embeddings.persona_clusterer import PersonaClusterer
from backend.graph.queries import GraphQueries
from backend.core.cache import UnifiedCache

OUT_DIR = "/run/media/sushitrash26/New Volume/GENAI/17thOct/soundgraph/docs/diagnostics/2026-10-20"
os.makedirs(OUT_DIR, exist_ok=True)

def main():
    db = Neo4jConnection()
    report = {}

    print("Running W0 Diagnostics Suite...")

    # -------------------------------------------------------------
    # D-01: Per-user listened & unlistened counts
    # -------------------------------------------------------------
    print("Computing D-01...")
    track_count = db.query("MATCH (t:Track) RETURN count(t) AS c")[0]["c"]
    user_q = """
    MATCH (u:User)
    OPTIONAL MATCH (u)-[r:LISTENED_TO]->(t:Track)
    RETURN u.id AS user_id, coalesce(u.name, 'Unknown') AS user_name, count(DISTINCT t) AS listened
    ORDER BY listened DESC
    """
    users = db.query(user_q)
    d01_data = []
    for u in users:
        listened = u["listened"]
        unlistened = track_count - listened
        d01_data.append({
            "user_id": u["user_id"],
            "user_name": u["user_name"],
            "listened": listened,
            "unlistened": unlistened,
            "pct_listened": round((listened / track_count) * 100, 2) if track_count else 0
        })
    report["D-01_user_catalog_coverage"] = {"catalog_size": track_count, "users": d01_data}

    # -------------------------------------------------------------
    # D-02: Acoustic feature distributions (proxy vs Spotify)
    # -------------------------------------------------------------
    print("Computing D-02...")
    q_feats = """
    MATCH (t:Track)
    RETURN t.id AS id, t.source AS source, t.energy AS energy, t.valence AS valence, 
           t.danceability AS danceability, t.tempo AS tempo
    """
    all_tracks = db.query(q_feats)
    
    def summarize(vals):
        valid = [v for v in vals if v is not None]
        if not valid:
            return {"count": 0}
        valid.sort()
        n = len(valid)
        mean_v = sum(valid) / n
        std_v = math.sqrt(sum((x - mean_v)**2 for x in valid) / n)
        hist, _ = [0]*10, None
        for x in valid:
            hist[min(9, int(x * 10))] += 1
        return {
            "count": n,
            "min": round(min(valid), 3),
            "max": round(max(valid), 3),
            "mean": round(mean_v, 3),
            "median": round(valid[n // 2], 3),
            "std": round(std_v, 3),
            "decile_histogram": hist
        }

    proxy_tracks = [t for t in all_tracks if t.get("source") != "spotify"]
    spotify_tracks = [t for t in all_tracks if t.get("source") == "spotify"]

    report["D-02_feature_distributions"] = {
        "text_proxy": {
            "total_tracks": len(proxy_tracks),
            "energy": summarize([t["energy"] for t in proxy_tracks]),
            "valence": summarize([t["valence"] for t in proxy_tracks]),
            "danceability": summarize([t["danceability"] for t in proxy_tracks]),
            "tempo_coverage": sum(1 for t in proxy_tracks if t.get("tempo") is not None)
        },
        "spotify_native": {
            "total_tracks": len(spotify_tracks),
            "energy": summarize([t["energy"] for t in spotify_tracks]),
            "valence": summarize([t["valence"] for t in spotify_tracks]),
            "danceability": summarize([t["danceability"] for t in spotify_tracks]),
            "tempo_coverage": sum(1 for t in spotify_tracks if t.get("tempo") is not None)
        }
    }

    # -------------------------------------------------------------
    # D-03: SIMILAR_TO graph topology & duplicate edge analysis
    # -------------------------------------------------------------
    print("Computing D-03...")
    edge_pairs_q = """
    MATCH (a:Track)-[s:SIMILAR_TO]->(b:Track)
    WITH a, b, count(s) AS n
    RETURN count(*) AS distinct_pairs, sum(n) AS total_edges, max(n) AS max_parallel
    """
    pairs_res = db.query(edge_pairs_q)[0]
    
    label_breakdown_q = """
    MATCH (a)-[r:SIMILAR_TO]->(b)
    RETURN head(labels(a)) AS src_type, head(labels(b)) AS tgt_type, count(r) AS cnt
    ORDER BY cnt DESC
    """
    labels_res = db.query(label_breakdown_q)

    track_degree_q = """
    MATCH (t:Track)
    OPTIONAL MATCH (t)-[r:SIMILAR_TO]-(other:Track)
    WITH t, count(r) AS degree
    RETURN t.id AS id, degree
    """
    deg_rows = db.query(track_degree_q)
    degs = sorted([r["degree"] for r in deg_rows])
    n_d = len(degs)
    report["D-03_graph_topology"] = {
        "track_to_track": {
            "distinct_pairs": pairs_res["distinct_pairs"],
            "total_edges": pairs_res["total_edges"],
            "max_parallel_edges": pairs_res["max_parallel"],
            "degree_stats": {
                "min": min(degs),
                "p25": degs[int(n_d * 0.25)],
                "median": degs[int(n_d * 0.50)],
                "p75": degs[int(n_d * 0.75)],
                "p90": degs[int(n_d * 0.90)],
                "max": max(degs),
                "isolated_tracks_count": sum(1 for d in degs if d == 0)
            }
        },
        "all_labels_breakdown": labels_res
    }

    # -------------------------------------------------------------
    # D-04: Preview audio reachability & strict playable verification
    # -------------------------------------------------------------
    print("Computing D-04...")
    q_prev = "MATCH (t:Track) RETURN t.id AS id, t.name AS name, t.preview_url AS url, t.source AS source"
    prev_tracks = db.query(q_prev)
    null_previews = [t for t in prev_tracks if not t.get("url")]
    non_null_previews = [t for t in prev_tracks if t.get("url")]

    def probe_preview(t):
        url = t["url"]
        try:
            req = urllib.request.Request(
                url, 
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Range": "bytes=0-1024"
                }
            )
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                code = resp.getcode()
                content_type = resp.headers.get("Content-Type", "")
                is_audio = "audio/" in content_type or url.endswith(".m4a") or url.endswith(".mp3")
                is_yt = "youtube.com" in url or "youtu.be" in url
                return {
                    "id": t["id"],
                    "code": code,
                    "content_type": content_type,
                    "is_strict_audio": is_audio and not is_yt,
                    "is_youtube_page": is_yt
                }
        except Exception as e:
            return {"id": t["id"], "code": str(e), "is_strict_audio": False, "is_youtube_page": False}

    probed_results = []
    with ThreadPoolExecutor(max_workers=25) as ex:
        futs = [ex.submit(probe_preview, t) for t in non_null_previews]
        for f in as_completed(futs):
            probed_results.append(f.result())

    strict_playable = sum(1 for r in probed_results if r.get("is_strict_audio"))
    yt_pages = sum(1 for r in probed_results if r.get("is_youtube_page"))

    report["D-04_preview_reliability"] = {
        "total_tracks": len(prev_tracks),
        "null_previews": len(null_previews),
        "youtube_web_links": yt_pages,
        "strict_playable_audio": strict_playable,
        "strict_playable_pct": round((strict_playable / len(prev_tracks)) * 100, 2)
    }

    # -------------------------------------------------------------
    # D-05 & D-06: Deck arm composition & artist repeats
    # -------------------------------------------------------------
    print("Computing D-05 & D-06...")
    active_users = [u["user_id"] for u in d01_data if u["listened"] >= 20]
    deck_stats = {}
    for uid in active_users:
        recs = GraphQueries.get_recommendations(user_id=uid, limit=15)
        arm_counts = Counter(r.get("bandit_arm", -1) for r in recs)
        arm_names = Counter(r.get("arm_name", "unknown") for r in recs)
        
        artists = []
        for r in recs:
            for a in r.get("artists") or []:
                artists.append(a)
        a_counts = Counter(artists)
        repeats = {a: c for a, c in a_counts.items() if c > 1}

        deck_stats[uid] = {
            "deck_size": len(recs),
            "arms": dict(arm_counts),
            "arm_names": dict(arm_names),
            "unique_artists": len(a_counts),
            "total_artist_credits": len(artists),
            "repeated_artists": repeats
        }
    report["D-05_D-06_deck_composition_and_artist_repeats"] = deck_stats

    # -------------------------------------------------------------
    # D-07: 50-Track YouTube Migration Audit Sample
    # -------------------------------------------------------------
    print("Generating D-07 CSV...")
    yt_query = """
    MATCH (t:Track {source: 'youtube'})
    OPTIONAL MATCH (t)-[:BY]->(a:Artist)
    OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
    RETURN t.id AS id, t.name AS title, collect(DISTINCT a.name) AS artists,
           t.uri AS uri, t.preview_url AS preview_url
    """
    yt_tracks = db.query(yt_query)
    random.seed(42)
    sample_yt = random.sample(yt_tracks, min(50, len(yt_tracks)))
    
    csv_path = os.path.join(OUT_DIR, "d07_youtube_audit_sample.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "index", "track_id", "original_title", "resolved_artists", 
            "preview_url", "audit_status (TODO: correct/wrong_version/wrong_song/no_match)", "audit_notes"
        ])
        for idx, t in enumerate(sample_yt, 1):
            writer.writerow([
                idx,
                t["id"],
                t["title"],
                ", ".join(t["artists"]),
                t.get("preview_url") or "",
                "", # Empty for owner manual review
                ""
            ])
    report["D-07_youtube_migration_sample"] = {
        "csv_path": csv_path,
        "sample_size": len(sample_yt)
    }

    # -------------------------------------------------------------
    # D-08: Persona mass vs share of final deck
    # -------------------------------------------------------------
    print("Computing D-08...")
    history_q = """
    MATCH (u:User {id: $uid})-[l:LISTENED_TO]->(t:Track)
    WHERE t.embedding IS NOT NULL
    OPTIONAL MATCH (t)-[:BY]->(a:Artist)
    OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
    OPTIONAL MATCH (u)-[f:FEEDBACK]->(t)
    RETURN t.id AS id, t.name AS name, t.embedding AS embedding,
           collect(DISTINCT a.name) AS artists, collect(DISTINCT g.name) AS genres,
           coalesce(l.play_count, 1) AS plays, coalesce(f.reward, 0.0) AS reward
    """
    persona_mass_stats = {}
    for uid in active_users:
        hist = db.query(history_q, {"uid": uid}) or []
        personas = PersonaClusterer.compute_taste_centroids(hist, max_k=3)
        total_w = sum(p["weight"] for p in personas) if personas else 1.0
        p_masses = {p["id"]: round(p["weight"] / total_w, 3) for p in personas}
        
        recs = GraphQueries.get_recommendations(user_id=uid, limit=15)
        # Check source reasons
        reason_counts = Counter(r.get("reason", "") for r in recs)
        
        persona_mass_stats[uid] = {
            "personas_count": len(personas),
            "persona_masses": p_masses,
            "recs_reasons": dict(reason_counts)
        }
    report["D-08_persona_mass_vs_deck"] = persona_mass_stats

    # -------------------------------------------------------------
    # D-09: Feedback & dwell events counts
    # -------------------------------------------------------------
    print("Computing D-09...")
    fb_q = """
    MATCH (u:User)-[f:FEEDBACK]->(t:Track)
    RETURN u.id AS uid, f.reward AS reward, f.dwell_ms AS dwell_ms, f.timestamp AS ts
    """
    fb_rows = db.query(fb_q)
    user_fb = defaultdict(lambda: {"likes": 0, "dislikes": 0, "dwell_events": 0})
    for r in fb_rows:
        uid = r["uid"]
        rew = r.get("reward")
        if rew == 1.0:
            user_fb[uid]["likes"] += 1
        elif rew == -1.0:
            user_fb[uid]["dislikes"] += 1
        if r.get("dwell_ms") is not None:
            user_fb[uid]["dwell_events"] += 1

    report["D-09_feedback_telemetry_counts"] = {
        "total_feedback_edges": len(fb_rows),
        "per_user": dict(user_fb)
    }

    # Save full JSON report
    json_path = os.path.join(OUT_DIR, "w0_diagnostics_report.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nAll W0 Diagnostics completed successfully! Saved to {json_path} and {csv_path}")

if __name__ == "__main__":
    main()
