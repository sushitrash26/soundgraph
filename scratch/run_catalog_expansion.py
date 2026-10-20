import sys
import os
import time

# Ensure project root is on PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.services.catalog_expansion import CatalogExpander
from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger

def main():
    print("=" * 70)
    print("SOUNDGRAPH WORKSTREAM W3: CATALOG EXPANSION PIPELINE")
    print("=" * 70)

    # 1. Initial State
    initial_stats = neo4j_conn.query("""
    MATCH (t:Track)
    RETURN count(t) AS total,
           count(CASE WHEN coalesce(t.preview_status, 'failed') = 'ok' THEN 1 END) AS playable
    """)[0]
    print(f"Initial Catalog: {initial_stats['total']} total tracks, {initial_stats['playable']} verified playable.")

    # 2. Run Catalog Expansion (Batch target: 300 new playable tracks in this step)
    target = 300
    print(f"\nStarting frontier crawl for up to {target} new playable studio tracks...")
    start_time = time.time()
    expander = CatalogExpander(rate_per_minute=120)
    result = expander.expand_catalog(
        target_new_tracks=target,
        max_per_artist=5,
        max_artists_to_scan=120
    )
    elapsed = time.time() - start_time

    # 3. Post-Expansion State
    post_stats = neo4j_conn.query("""
    MATCH (t:Track)
    RETURN count(t) AS total,
           count(CASE WHEN coalesce(t.preview_status, 'failed') = 'ok' THEN 1 END) AS playable
    """)[0]
    print("\n" + "=" * 70)
    print("CATALOG EXPANSION COMPLETE")
    print("=" * 70)
    print(f"Artists Scanned:        {result['artists_scanned']}")
    print(f"Newly Ingested Tracks:  {result['newly_ingested_tracks']}")
    print(f"Total Playable Catalog: {post_stats['playable']} tracks (was {initial_stats['playable']})")
    print(f"Total Graph Catalog:    {post_stats['total']} tracks (was {initial_stats['total']})")
    print(f"Time Elapsed:           {elapsed:.1f}s")

if __name__ == "__main__":
    main()
