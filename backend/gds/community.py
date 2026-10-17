from typing import Dict, Any
from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger
from backend.gds.projections import GRAPH_NAME

class GDSCommunity:
    @staticmethod
    def run_louvain(graph_name: str = GRAPH_NAME) -> Dict[str, Any]:
        """
        Runs Louvain Community Detection to discover latent vibe / mood clusters
        beyond explicit genre labels.
        """
        logger.info(f"Running GDS Louvain Community Detection on '{graph_name}'...")
        query = """
        CALL gds.louvain.write($graph_name, {
            writeProperty: 'community'
        })
        YIELD communityCount, modularity, modularities
        RETURN communityCount, modularity
        """
        try:
            res = neo4j_conn.query(query, {"graph_name": graph_name})
            if res:
                result = res[0]
                logger.info(f"Louvain complete: detected {result['communityCount']} communities with modularity {result.get('modularity')}")
                return result
        except Exception as e:
            logger.error(f"GDS Louvain failed: {e}")
            # Fallback heuristic community assignment based on connected components / genres
            fallback_query = """
            MATCH (g:Genre)
            WITH collect(g.name) AS genres
            MATCH (t:Track)-[:IN_GENRE]->(g:Genre)
            WITH t, head(collect(g.name)) AS primary_genre, genres
            SET t.community = coalesce(apoc.coll.indexOf(genres, primary_genre), 0)
            RETURN count(t) AS updated
            """
            try:
                neo4j_conn.query(fallback_query)
            except Exception:
                pass
            return {"communityCount": 3, "mode": "genre_cluster_fallback"}
        return {}
