"""
Graph Topology Pruning and Degree Bounding Script (Workstream W7).
Resolves F-07 and enforces D-0023:
1. Deletes all non-Track SIMILAR_TO relationships (35,000+ spurious edges).
2. Deduplicates parallel track-to-track SIMILAR_TO relationships down to a single edge with max score.
3. Enforces mutual top-10 degree bound per track, keeping the top 10 highest-scoring neighbors.
4. Tags all surviving edges with source='hnsw_pruned'.
"""

import time
from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger

def get_stats():
    res = {}
    res["total_similar_to"] = neo4j_conn.query("""
        MATCH ()-[r:SIMILAR_TO]->() RETURN count(r) as c
    """)[0]["c"]
    
    res["track_to_track"] = neo4j_conn.query("""
        MATCH (t1:Track)-[r:SIMILAR_TO]->(t2:Track) RETURN count(r) as c
    """)[0]["c"]

    res["non_track"] = neo4j_conn.query("""
        MATCH (a)-[r:SIMILAR_TO]->(b)
        WHERE NOT (a:Track AND b:Track)
        RETURN count(r) as c
    """)[0]["c"]

    max_deg_res = neo4j_conn.query("""
        MATCH (t:Track)-[r:SIMILAR_TO]->()
        WITH t, count(r) as deg
        RETURN max(deg) as max_deg, avg(deg) as avg_deg
    """)
    if max_deg_res and max_deg_res[0]["max_deg"] is not None:
        res["max_degree"] = max_deg_res[0]["max_deg"]
        res["avg_degree"] = round(float(max_deg_res[0]["avg_deg"]), 2)
    else:
        res["max_degree"] = 0
        res["avg_degree"] = 0.0

    return res

def prune_non_track_edges():
    logger.info("Step 1: Deleting non-track SIMILAR_TO edges...")
    deleted = 0
    while True:
        # Delete in batches of 5000
        q = """
        MATCH (a)-[r:SIMILAR_TO]->(b)
        WHERE NOT (a:Track AND b:Track)
        WITH r LIMIT 5000
        DELETE r
        RETURN count(r) as count
        """
        c = neo4j_conn.query(q)[0]["count"]
        deleted += c
        logger.info(f"  Deleted batch of {c} non-track edges (total: {deleted})")
        if c == 0:
            break
    return deleted

def deduplicate_and_bound_track_edges(max_degree: int = 10):
    logger.info(f"Step 2: Deduplicating and bounding track-to-track SIMILAR_TO edges to top-{max_degree}...")
    
    # 2a. Deduplicate parallel edges between same (t1, t2)
    logger.info("  2a. Deduplicating parallel edges between identical track pairs...")
    dedup_query = """
    MATCH (t1:Track)-[r:SIMILAR_TO]->(t2:Track)
    WITH t1, t2, collect(r) as rels
    WHERE size(rels) > 1
    WITH rels[0] as keep_rel, rels[1..] as delete_rels, 
         reduce(m = 0.0, r IN rels | CASE WHEN coalesce(r.score, 0.8) > m THEN coalesce(r.score, 0.8) ELSE m END) as max_s
    SET keep_rel.score = max_s, keep_rel.source = 'hnsw_pruned'
    FOREACH (del IN delete_rels | DELETE del)
    RETURN count(delete_rels) as deleted_duplicates
    """
    res_dedup = neo4j_conn.query(dedup_query)
    logger.info(f"  Deduplicated parallel pairs: {res_dedup}")

    # Set source='hnsw_pruned' on all existing track edges
    neo4j_conn.query("""
        MATCH (t1:Track)-[r:SIMILAR_TO]->(t2:Track)
        SET r.source = 'hnsw_pruned', r.score = coalesce(r.score, 0.80)
    """)

    # 2b. Enforce top-K degree per track
    logger.info(f"  2b. Enforcing max degree {max_degree} per track...")
    prune_degree_query = f"""
    MATCH (t1:Track)-[r:SIMILAR_TO]->(t2:Track)
    WITH t1, r ORDER BY coalesce(r.score, 0.80) DESC
    WITH t1, collect(r) as all_rels
    WHERE size(all_rels) > {max_degree}
    WITH all_rels[{max_degree}..] as excess_rels
    FOREACH (del IN excess_rels | DELETE del)
    RETURN count(excess_rels) as deleted_excess
    """
    res_deg = neo4j_conn.query(prune_degree_query)
    logger.info(f"  Pruned excess degree edges: {res_deg}")

def run_pruning():
    logger.info("=== Graph Topology Pruning (W7) ===")
    before = get_stats()
    logger.info(f"Before stats: {before}")

    t0 = time.time()
    prune_non_track_edges()
    deduplicate_and_bound_track_edges(max_degree=10)
    elapsed = round(time.time() - t0, 2)

    after = get_stats()
    logger.info(f"After stats: {after}")
    logger.info(f"Completed pruning in {elapsed}s.")
    return {"before": before, "after": after, "elapsed_s": elapsed}

if __name__ == "__main__":
    run_pruning()
