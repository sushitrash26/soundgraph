import sys
import os
import json
import time
import math
from typing import Dict, List, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request
import urllib.error

# Ensure project root is in sys.path
sys.path.insert(0, "/run/media/sushitrash26/New Volume/GENAI/17thOct/soundgraph")

from backend.core.neo4j_driver import Neo4jConnection
from backend.embeddings.persona_clusterer import PersonaClusterer
from backend.graph.queries import GraphQueries

def print_header(title: str):
    print("\n" + "=" * 70)
    print(f" {title} ")
    print("=" * 70)

def run():
    neo4j = Neo4jConnection()
    
    # -------------------------------------------------------------
    # 1. Histogram of energy and valence on text_proxy tracks
    # -------------------------------------------------------------
    print_header("1. HISTOGRAM OF ENERGY AND VALENCE ON TEXT_PROXY TRACKS")
    # text_proxy tracks are tracks where source <> 'spotify' (YouTube, hexasonic, etc.)
    text_proxy_query = """
    MATCH (t:Track)
    WHERE (t.source IS NULL OR t.source <> 'spotify')
    RETURN t.id AS id, t.name AS name, t.source AS source, t.energy AS energy, t.valence AS valence
    """
    tp_tracks = neo4j.query(text_proxy_query)
    
    spotify_query = """
    MATCH (t:Track)
    WHERE t.source = 'spotify'
    RETURN t.id AS id, t.name AS name, t.source AS source, t.energy AS energy, t.valence AS valence
    """
    sp_tracks = neo4j.query(spotify_query)
    
    def analyze_feature(values: List[float], name: str):
        valid = [v for v in values if v is not None]
        if not valid:
            print(f"No valid data for {name}")
            return
        valid.sort()
        n = len(valid)
        mean_val = sum(valid) / n
        median_val = valid[n // 2]
        variance = sum((x - mean_val) ** 2 for x in valid) / n
        std_val = math.sqrt(variance)
        min_val = min(valid)
        max_val = max(valid)
        
        # 10 bins: [0.0, 0.1), [0.1, 0.2), ..., [0.9, 1.0]
        bins = [0] * 10
        for v in valid:
            idx = min(9, int(v * 10))
            bins[idx] += 1
            
        print(f"\nFeature: {name.upper()} (N = {n}, Min={min_val:.2f}, Max={max_val:.2f}, Mean={mean_val:.2f}, Median={median_val:.2f}, Std={std_val:.2f})")
        print("  Range      Count   Pct     ASCII Bar")
        for i in range(10):
            low = i * 0.1
            high = (i + 1) * 0.1
            cnt = bins[i]
            pct = (cnt / n) * 100
            bar = "#" * int(pct // 2)
            print(f"  [{low:.1f}-{high:.1f})   {cnt:5d}  ({pct:5.1f}%)  {bar}")
            
    print(f"Total text_proxy tracks found: {len(tp_tracks)}")
    tp_energies = [t.get("energy") for t in tp_tracks]
    tp_valences = [t.get("valence") for t in tp_tracks]
    analyze_feature(tp_energies, "text_proxy energy")
    analyze_feature(tp_valences, "text_proxy valence")
    
    print(f"\nComparison: Spotify Audio Feature tracks (N = {len(sp_tracks)})")
    sp_energies = [t.get("energy") for t in sp_tracks]
    sp_valences = [t.get("valence") for t in sp_tracks]
    analyze_feature(sp_energies, "spotify energy")
    analyze_feature(sp_valences, "spotify valence")

    # -------------------------------------------------------------
    # 2. SIMILAR_TO degree distribution
    # -------------------------------------------------------------
    print_header("2. SIMILAR_TO DEGREE DISTRIBUTION")
    degree_query = """
    MATCH (t:Track)
    OPTIONAL MATCH (t)-[r:SIMILAR_TO]-(other:Track)
    WITH t, count(r) AS degree,
         count(CASE WHEN startNode(r) = t THEN 1 END) AS out_degree,
         count(CASE WHEN endNode(r) = t THEN 1 END) AS in_degree
    RETURN t.id AS id, degree, out_degree, in_degree
    """
    degree_rows = neo4j.query(degree_query)
    total_tracks = len(degree_rows)
    degrees = sorted([r["degree"] for r in degree_rows])
    out_degrees = sorted([r["out_degree"] for r in degree_rows])
    in_degrees = sorted([r["in_degree"] for r in degree_rows])
    
    total_edges_query = "MATCH ()-[r:SIMILAR_TO]->() RETURN count(r) AS edge_count"
    total_edges = neo4j.query(total_edges_query)[0]["edge_count"]
    
    def get_percentiles(vals):
        n = len(vals)
        return {
            "p25": vals[int(n * 0.25)],
            "p50 (median)": vals[int(n * 0.50)],
            "p75": vals[int(n * 0.75)],
            "p90": vals[int(n * 0.90)],
            "p95": vals[int(n * 0.95)],
            "p99": vals[int(n * 0.99)],
        }
    
    mean_deg = sum(degrees) / total_tracks if total_tracks else 0
    print(f"Total Track Nodes: {total_tracks}")
    print(f"Total Directed SIMILAR_TO Edges: {total_edges}")
    print(f"Total Undirected Degree Mean: {mean_deg:.2f}, Min: {min(degrees)}, Max: {max(degrees)}")
    print(f"Out-Degree Mean: {sum(out_degrees)/total_tracks:.2f}, Min: {min(out_degrees)}, Max: {max(out_degrees)}")
    print(f"In-Degree Mean:  {sum(in_degrees)/total_tracks:.2f}, Min: {min(in_degrees)}, Max: {max(in_degrees)}")
    print("Percentiles of Total Undirected Degree:", get_percentiles(degrees))
    
    # Degree Buckets
    buckets = [
        ("0 (isolated)", lambda d: d == 0),
        ("1 - 10", lambda d: 1 <= d <= 10),
        ("11 - 50", lambda d: 11 <= d <= 50),
        ("51 - 100", lambda d: 51 <= d <= 100),
        ("101 - 200", lambda d: 101 <= d <= 200),
        ("201 - 300", lambda d: 201 <= d <= 300),
        ("> 300", lambda d: d > 300),
    ]
    print("\nDegree Distribution Buckets:")
    for label, fn in buckets:
        cnt = sum(1 for d in degrees if fn(d))
        pct = (cnt / total_tracks) * 100
        bar = "#" * int(pct // 2)
        print(f"  {label:15s}: {cnt:4d} tracks ({pct:5.1f}%)  {bar}")

    # -------------------------------------------------------------
    # 3. Unlistened-track count per user
    # -------------------------------------------------------------
    print_header("3. UNLISTENED-TRACK COUNT PER USER")
    user_query = """
    MATCH (u:User)
    OPTIONAL MATCH (u)-[r:LISTENED_TO]->(t:Track)
    RETURN u.id AS user_id, coalesce(u.name, u.display_name, 'Unknown') AS user_name,
           count(DISTINCT t) AS listened_count
    ORDER BY listened_count DESC
    """
    user_rows = neo4j.query(user_query)
    print(f"Total Catalog Size N = {total_tracks} tracks\n")
    print(f"{'User ID':<35} | {'User Name':<20} | {'Listened (n)':<12} | {'Unlistened':<12} | {'% Unlistened'}")
    print("-" * 95)
    for u in user_rows:
        listened = u["listened_count"]
        unlistened = total_tracks - listened
        pct_unlistened = (unlistened / total_tracks) * 100 if total_tracks else 0
        print(f"{u['user_id']:<35} | {u['user_name']:<20} | {listened:<12} | {unlistened:<12} | {pct_unlistened:6.1f}%")

    # -------------------------------------------------------------
    # 4. Percent of tracks with a non-null, reachable preview_url
    # -------------------------------------------------------------
    print_header("4. PERCENT OF TRACKS WITH NON-NULL & REACHABLE PREVIEW_URL")
    preview_query = """
    MATCH (t:Track)
    RETURN t.id AS id, t.name AS name, t.preview_url AS preview_url, t.source AS source
    """
    track_previews = neo4j.query(preview_query)
    null_previews = [t for t in track_previews if not t.get("preview_url")]
    non_null_previews = [t for t in track_previews if t.get("preview_url")]
    
    print(f"Total Tracks: {len(track_previews)}")
    print(f"Tracks with NULL preview_url:     {len(null_previews):4d} ({len(null_previews)/len(track_previews)*100:5.1f}%)")
    print(f"Tracks with NON-NULL preview_url: {len(non_null_previews):4d} ({len(non_null_previews)/len(track_previews)*100:5.1f}%)")
    
    print("\nProbing live reachability of non-null preview URLs via concurrent HTTP range/head checks...")
    
    def check_url(t):
        url = t["preview_url"]
        try:
            req = urllib.request.Request(
                url, 
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
                    "Range": "bytes=0-1024"
                }
            )
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                code = resp.getcode()
                return (t, code, True)
        except urllib.error.HTTPError as e:
            return (t, e.code, False)
        except Exception as e:
            return (t, str(e), False)

    status_counts = {}
    domain_counts = {}
    with ThreadPoolExecutor(max_workers=25) as executor:
        futures = [executor.submit(check_url, t) for t in non_null_previews]
        for f in as_completed(futures):
            t, code, success = f.result()
            status_counts[code] = status_counts.get(code, 0) + 1
            domain = t["preview_url"].split("/")[2] if "//" in t["preview_url"] else "unknown"
            domain_counts[domain] = domain_counts.get(domain, 0) + 1

    reachable_count = sum(cnt for code, cnt in status_counts.items() if code in (200, 206, 302))
    unreachable_count = len(non_null_previews) - reachable_count
    
    print(f"Reachable URLs:   {reachable_count:4d} ({reachable_count/len(non_null_previews)*100:5.1f}% of non-null, {reachable_count/len(track_previews)*100:5.1f}% of total catalog)")
    print(f"Unreachable URLs: {unreachable_count:4d} ({unreachable_count/len(non_null_previews)*100:5.1f}% of non-null)")
    print("HTTP Status Code Breakdown:")
    for code, cnt in sorted(status_counts.items(), key=lambda x: str(x[0])):
        print(f"  HTTP {code}: {cnt} tracks")
    print("Preview URL Domains:")
    for dom, cnt in sorted(domain_counts.items(), key=lambda x: -x[1]):
        print(f"  {dom}: {cnt} tracks")

    # -------------------------------------------------------------
    # 5. Artist repeats per deck
    # -------------------------------------------------------------
    print_header("5. ARTIST REPEATS PER DECK")
    # Test recommendations generation for users with history and test artist multiplicity
    test_users = [u["user_id"] for u in user_rows if u["listened_count"] > 0][:3]
    # Add guest user for cold-start comparison
    test_users.append("demo_guest_user")
    
    for uid in test_users:
        print(f"\n--- Testing User: {uid} ---")
        decks = []
        cumulative_excluded = set()
        for deck_num in range(1, 4):
            recs = GraphQueries.get_recommendations(
                user_id=uid,
                limit=15,
                exclude_ids=list(cumulative_excluded)
            )
            if not recs:
                print(f"  Deck {deck_num}: Empty (catalog exhausted or no recommendations)")
                break
                
            artists_in_deck = []
            for r in recs:
                a_list = r.get("artists") or []
                for a in a_list:
                    artists_in_deck.append(a)
                cumulative_excluded.add(r["track_id"])
                
            from collections import Counter
            counts = Counter(artists_in_deck)
            repeats = {a: c for a, c in counts.items() if c > 1}
            total_artists = len(artists_in_deck)
            unique_artists = len(counts)
            repeat_slots = total_artists - unique_artists
            
            print(f"  Deck {deck_num} (Tracks: {len(recs)}): Unique Artists: {unique_artists}/{total_artists} | Repeat Slots: {repeat_slots}")
            if repeats:
                print(f"    Repeated Artists: {repeats}")
            else:
                print("    Repeated Artists: None (100% distinct artists)")

    # -------------------------------------------------------------
    # 6. Real K per user and actual n per user
    # -------------------------------------------------------------
    print_header("6. REAL K PER USER AND ACTUAL n PER USER")
    history_query = """
    MATCH (u:User {id: $user_id})-[l:LISTENED_TO]->(t:Track)
    WHERE t.embedding IS NOT NULL
    OPTIONAL MATCH (t)-[:BY]->(a:Artist)
    OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
    OPTIONAL MATCH (u)-[f:FEEDBACK]->(t)
    RETURN t.id AS id, t.name AS name, t.embedding AS embedding,
           collect(DISTINCT a.name) AS artists, collect(DISTINCT g.name) AS genres,
           coalesce(l.play_count, 1) AS plays, coalesce(f.reward, 0.0) AS reward
    """
    for u in user_rows:
        uid = u["user_id"]
        uname = u["user_name"]
        raw_n = u["listened_count"]
        history = neo4j.query(history_query, {"user_id": uid}) or []
        valid_n = len(history)
        personas = PersonaClusterer.compute_taste_centroids(history, max_k=3)
        real_k = len(personas)
        
        print(f"\nUser: {uname} ({uid})")
        print(f"  Actual n (listened tracks in DB): {raw_n}")
        print(f"  n with valid 768-D embeddings:   {valid_n}")
        print(f"  Real K (computed personas):      {real_k}")
        for idx, p in enumerate(personas):
            print(f"    Persona {idx+1}: '{p.get('label')}' (Weight={p.get('weight', 0):.1f}, Seeds={p.get('seed_tracks', [])[:2]})")

if __name__ == "__main__":
    run()
