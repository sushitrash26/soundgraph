from typing import Dict, Any
from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger
from backend.gds.projections import GRAPH_NAME

class GDSPageRank:
    @staticmethod
    def run_pagerank(graph_name: str = GRAPH_NAME, max_iterations: int = 20, damping_factor: float = 0.85) -> Dict[str, Any]:
        """
        Runs PageRank algorithm to surface most influential and central artists/tracks
        in the user's unified taste graph.
        """
        logger.info(f"Running GDS PageRank on projection '{graph_name}'...")
        query = """
        CALL gds.pageRank.write($graph_name, {
            writeProperty: 'pagerank',
            maxIterations: $max_iterations,
            dampingFactor: $damping_factor
        })
        YIELD nodePropertiesWritten, computeMillis, writeMillis
        RETURN nodePropertiesWritten, computeMillis, writeMillis
        """
        try:
            res = neo4j_conn.query(query, {
                "graph_name": graph_name,
                "max_iterations": max_iterations,
                "damping_factor": damping_factor
            })
            if res:
                result = res[0]
                logger.info(f"PageRank complete: {result['nodePropertiesWritten']} node properties written.")
                return result
        except Exception as e:
            logger.error(f"GDS PageRank failed: {e}")
            # Fallback heuristic calculation based on degree centrality
            fallback_query = """
            MATCH (a:Artist)
            OPTIONAL MATCH (t:Track)-[:BY]->(a)
            OPTIONAL MATCH (u:User)-[r:LISTENED_TO]->(t)
            WITH a, count(DISTINCT t) AS deg, coalesce(sum(r.play_count), 1) AS plays
            SET a.pagerank = round(0.15 + (deg * 0.12) + (plays * 0.02), 3)
            RETURN count(a) AS nodePropertiesWritten
            """
            fb_res = neo4j_conn.query(fallback_query)
            count = fb_res[0]["nodePropertiesWritten"] if fb_res else 0
            return {"nodePropertiesWritten": count, "mode": "degree_fallback"}
        return {}
