from typing import Dict, Any
from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger

GRAPH_NAME = "trackGraph"

class GDSProjectionManager:
    @staticmethod
    def drop_projection_if_exists(graph_name: str = GRAPH_NAME) -> bool:
        check_query = "CALL gds.graph.exists($name) YIELD exists"
        try:
            res = neo4j_conn.query(check_query, {"name": graph_name})
            if res and res[0].get("exists"):
                drop_query = "CALL gds.graph.drop($name) YIELD graphName"
                neo4j_conn.query(drop_query, {"name": graph_name})
                logger.info(f"Dropped GDS projection '{graph_name}'")
                return True
        except Exception as e:
            logger.warning(f"Error checking/dropping projection: {e}")
        return False

    @staticmethod
    def project_taste_graph(graph_name: str = GRAPH_NAME) -> Dict[str, Any]:
        """Projects in-memory graph containing Track, Artist, Genre nodes and relationships"""
        GDSProjectionManager.drop_projection_if_exists(graph_name)

        project_query = """
        CALL gds.graph.project(
            $name,
            {
                Track: { label: 'Track' },
                Artist: { label: 'Artist' },
                Genre: { label: 'Genre' }
            },
            {
                BY: { type: 'BY', orientation: 'UNDIRECTED' },
                IN_GENRE: { type: 'IN_GENRE', orientation: 'UNDIRECTED' }
            }
        )
        YIELD graphName, nodeCount, relationshipCount, projectMillis
        RETURN graphName, nodeCount, relationshipCount, projectMillis
        """
        try:
            res = neo4j_conn.query(project_query, {"name": graph_name})
            if res:
                info = res[0]
                logger.info(f"GDS Graph '{info['graphName']}' projected: {info['nodeCount']} nodes, {info['relationshipCount']} relationships in {info['projectMillis']}ms")
                return info
        except Exception as e:
            logger.error(f"Failed to project graph '{graph_name}': {e}")
            raise e
        return {}
