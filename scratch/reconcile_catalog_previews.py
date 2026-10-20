import sys
import os
import time
from typing import Dict, Any, List
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, "/run/media/sushitrash26/New Volume/GENAI/17thOct/soundgraph")

from backend.core.neo4j_driver import Neo4jConnection
from backend.services.preview_service import PreviewResolver, PreviewVerifier
from backend.core.logger import logger

def reconcile():
    db = Neo4jConnection()
    
    print("Fetching all tracks from Neo4j...")
    query = """
    MATCH (t:Track)
    OPTIONAL MATCH (t)-[:BY]->(a:Artist)
    RETURN t.id AS id, t.name AS name, t.preview_url AS preview_url, 
           t.source AS source, t.duration_ms AS duration_ms,
           collect(DISTINCT a.name) AS artists
    """
    tracks = db.query(query)
    total = len(tracks)
    print(f"Total tracks found: {total}")

    # Step 1: Separate into already valid iTunes previews vs unverified/missing/youtube
    valid_itunes = []
    needs_resolution = []

    for t in tracks:
        purl = t.get("preview_url") or ""
        if purl and "audio-ssl.itunes.apple.com" in purl:
            valid_itunes.append(t)
        else:
            needs_resolution.append(t)

    print(f"Tracks with existing iTunes URLs: {len(valid_itunes)}")
    print(f"Tracks needing new audio resolution: {len(needs_resolution)}")

    # Update valid iTunes tracks in bulk
    print("Verifying existing iTunes tracks...")
    verified_ok_ids = []
    verified_fail_ids = []

    def verify_existing(t):
        is_ok, reason, _ = PreviewVerifier.verify_url(t["preview_url"])
        return t["id"], is_ok, reason

    with ThreadPoolExecutor(max_workers=20) as ex:
        futs = [ex.submit(verify_existing, t) for t in valid_itunes]
        for f in as_completed(futs):
            tid, is_ok, reason = f.result()
            if is_ok:
                verified_ok_ids.append(tid)
            else:
                verified_fail_ids.append((tid, reason))

    print(f"Existing iTunes tracks verified OK: {len(verified_ok_ids)}, Failed: {len(verified_fail_ids)}")

    # Mark existing verified tracks in Neo4j
    if verified_ok_ids:
        db.query("""
        UNWIND $ids AS tid
        MATCH (t:Track {id: tid})
        SET t.preview_source = 'itunes',
            t.preview_status = 'ok',
            t.preview_verified_at = datetime(),
            t.match_confidence = 1.0
        """, {"ids": verified_ok_ids})

    if verified_fail_ids:
        fail_ids = [tid for tid, _ in verified_fail_ids]
        db.query("""
        UNWIND $ids AS tid
        MATCH (t:Track {id: tid})
        SET t.preview_status = 'failed',
            t.preview_verified_at = datetime()
        """, {"ids": fail_ids})

    # Step 2: Resolve tracks that need resolution (rate-limited via PreviewResolver)
    print("\nResolving tracks needing audio previews (rate-limited via iTunes/Deezer token bucket)...")
    resolved_ok_updates = []
    unresolvable_ids = []

    for idx, t in enumerate(needs_resolution, 1):
        title = t["name"]
        artists = t["artists"]
        dur = t.get("duration_ms")
        tid = t["id"]

        print(f"[{idx}/{len(needs_resolution)}] Resolving: '{title}' by {artists}...")
        res = PreviewResolver.resolve_track(title=title, artists=artists, duration_ms=dur)

        if res and res.get("preview_status") == "ok":
            print(f"  -> MATCHED ({res['preview_source']}): '{res['resolved_title']}' (conf: {res['match_confidence']})")
            resolved_ok_updates.append({
                "id": tid,
                "preview_url": res["preview_url"],
                "preview_source": res["preview_source"],
                "preview_status": "ok",
                "match_confidence": res["match_confidence"],
                "itunes_track_id": res.get("itunes_track_id") or "",
                "cover_url": res.get("cover_url") or "",
                "duration_ms": res.get("duration_ms") or dur
            })
        else:
            print(f"  -> NO MATCH (status: failed)")
            unresolvable_ids.append(tid)

    # Persist resolved tracks to Neo4j
    if resolved_ok_updates:
        print(f"\nPersisting {len(resolved_ok_updates)} newly resolved tracks to Neo4j...")
        db.query("""
        UNWIND $updates AS u
        MATCH (t:Track {id: u.id})
        SET t.preview_url = u.preview_url,
            t.preview_source = u.preview_source,
            t.preview_status = u.preview_status,
            t.preview_verified_at = datetime(),
            t.match_confidence = u.match_confidence,
            t.itunes_track_id = u.itunes_track_id
        """, {"updates": resolved_ok_updates})

    if unresolvable_ids:
        print(f"Marking {len(unresolvable_ids)} unresolvable tracks as preview_status = 'failed'...")
        db.query("""
        UNWIND $ids AS tid
        MATCH (t:Track {id: tid})
        SET t.preview_status = 'failed',
            t.preview_verified_at = datetime(),
            t.match_confidence = 0.0
        """, {"ids": unresolvable_ids})

    # Summary
    final_stats = db.query("""
    MATCH (t:Track)
    RETURN t.preview_status AS status, count(t) AS count
    """)
    print("\nFinal Track Preview Status in Neo4j:")
    for row in final_stats:
        print(f"  Status '{row['status']}': {row['count']} tracks")

if __name__ == "__main__":
    reconcile()
