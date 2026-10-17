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
            # Vector-driven similarity linking using true 768-D Gemini embeddings
            fallback_sim_query = """
            MATCH (t1:Track), (t2:Track)
            WHERE elementId(t1) < elementId(t2)
              AND t1.embedding IS NOT NULL
              AND t2.embedding IS NOT NULL
            WITH t1, t2, vector.similarity.cosine(t1.embedding, t2.embedding) AS cos_sim
            WHERE cos_sim >= 0.72
            MERGE (t1)-[r:SIMILAR_TO]->(t2)
            SET r.score = round(cos_sim, 3)
            MERGE (t2)-[r2:SIMILAR_TO]->(t1)
            SET r2.score = round(cos_sim, 3)
            RETURN count(r) AS relationshipsWritten
            """
            logger.info("Executing vector-driven latent similarity fallback...")
            fb_res = neo4j_conn.query(fallback_sim_query)
            count = fb_res[0]["relationshipsWritten"] if fb_res else 0
            return {"relationshipsWritten": count, "mode": "vector_cosine_fallback"}
        return {}
