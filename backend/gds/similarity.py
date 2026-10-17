from typing import Dict, Any
from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger
from backend.gds.projections import GRAPH_NAME

class GDSSimilarity:
    @staticmethod
    def run_node_similarity(graph_name: str = GRAPH_NAME, top_k: int = 10, cutoff: float = 0.05) -> Dict[str, Any]:
        """
        Computes Jaccard/Cosine similarity between nodes based on shared neighborhood
        and writes SIMILAR_TO relationship directly back into the Neo4j graph.
        """
        logger.info(f"Running GDS NodeSimilarity on projection '{graph_name}' (topK={top_k}, cutoff={cutoff})...")
        query = """
        CALL gds.nodeSimilarity.write($graph_name, {
            writeRelationshipType: 'SIMILAR_TO',
            writeProperty: 'score',
            topK: $top_k,
            similarityCutoff: $cutoff
        })
        YIELD nodesCompared, relationshipsWritten, computeMillis, writeMillis
        RETURN nodesCompared, relationshipsWritten, computeMillis, writeMillis
        """
        try:
            res = neo4j_conn.query(query, {
                "graph_name": graph_name,
                "top_k": top_k,
                "cutoff": cutoff
            })
            if res:
                result = res[0]
                logger.info(f"NodeSimilarity complete: {result['relationshipsWritten']} SIMILAR_TO relationships written.")
                return result
        except Exception as e:
            logger.error(f"GDS NodeSimilarity failed: {e}")
            # Fallback Cypher based similarity linking if GDS projection has disconnected components
            fallback_sim_query = """
            MATCH (t1:Track)-[:IN_GENRE]->(g:Genre)<-[:IN_GENRE]-(t2:Track)
            WHERE id(t1) < id(t2)
            WITH t1, t2, count(DISTINCT g) AS common_genres
            WHERE common_genres >= 1
            MERGE (t1)-[r:SIMILAR_TO]->(t2)
            ON CREATE SET r.score = round(0.50 + (common_genres * 0.15), 2)
            MERGE (t2)-[r2:SIMILAR_TO]->(t1)
            ON CREATE SET r2.score = round(0.50 + (common_genres * 0.15), 2)
            RETURN count(r) AS relationshipsWritten
            """
            logger.info("Executing Cypher-based semantic neighborhood similarity fallback...")
            fb_res = neo4j_conn.query(fallback_sim_query)
            count = fb_res[0]["relationshipsWritten"] if fb_res else 0
            return {"relationshipsWritten": count, "mode": "heuristic_fallback"}
        return {}
