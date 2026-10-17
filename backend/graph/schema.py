from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger

CONSTRAINTS_AND_INDEXES = [
    # Constraints
    "CREATE CONSTRAINT track_id IF NOT EXISTS FOR (t:Track) REQUIRE t.id IS UNIQUE",
    "CREATE CONSTRAINT artist_id IF NOT EXISTS FOR (a:Artist) REQUIRE a.id IS UNIQUE",
    "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
    "CREATE CONSTRAINT genre_name IF NOT EXISTS FOR (g:Genre) REQUIRE g.name IS UNIQUE",
    "CREATE CONSTRAINT album_id IF NOT EXISTS FOR (al:Album) REQUIRE al.id IS UNIQUE",
    # Indexes
    "CREATE INDEX track_name IF NOT EXISTS FOR (t:Track) ON (t.name)",
    "CREATE INDEX artist_name IF NOT EXISTS FOR (a:Artist) ON (a.name)",
    "CREATE INDEX user_name IF NOT EXISTS FOR (u:User) ON (u.name)",
]

def init_schema():
    logger.info("Initializing Neo4j Graph Schema, Constraints, and Indexes...")
    for stmt in CONSTRAINTS_AND_INDEXES:
        try:
            neo4j_conn.query(stmt)
            logger.info(f"Schema statement applied: {stmt.split('FOR')[0].strip()}")
        except Exception as e:
            logger.warning(f"Schema statement '{stmt}' warning: {e}")
    logger.info("Neo4j Graph Schema setup complete.")
