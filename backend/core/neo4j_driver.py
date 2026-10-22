from typing import Any, Dict, List, Optional
from neo4j import GraphDatabase, Driver
from backend.core.config import settings
from backend.core.logger import logger

class Neo4jConnection:
    _instance: Optional["Neo4jConnection"] = None
    _driver: Optional[Driver] = None

    def __new__(cls) -> "Neo4jConnection":
        if cls._instance is None:
            cls._instance = super(Neo4jConnection, cls).__new__(cls)
        return cls._instance

    def connect(self) -> Driver:
        if self._driver is None:
            logger.info(f"Connecting to Neo4j at {settings.NEO4J_URI} as {settings.NEO4J_USER}...")
            self._driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
                max_connection_lifetime=3600,
                max_connection_pool_size=50,
                connection_acquisition_timeout=60,
            )
            self._driver.verify_connectivity()
            logger.info("Successfully connected to Neo4j instance.")
        return self._driver

    def get_driver(self) -> Driver:
        if self._driver is None:
            return self.connect()
        return self._driver

    def close(self) -> None:
        if self._driver is not None:
            logger.info("Closing Neo4j driver connection...")
            self._driver.close()
            self._driver = None

    def _get_session_kwargs(self, db: Optional[str] = None) -> Dict[str, Any]:
        target_db = db if db is not None else settings.NEO4J_DATABASE
        # On Neo4j AuraDB, 'neo4j' does not exist if multi-tenant or named after instance.
        # If target_db is 'neo4j' or empty, check if NEO4J_USER is specific (e.g. c1054991) or omit database.
        if not target_db or target_db == "neo4j":
            if settings.NEO4J_USER and settings.NEO4J_USER != "neo4j":
                return {"database": settings.NEO4J_USER}
            return {}
        return {"database": target_db}

    def query(self, query: str, parameters: Optional[Dict[str, Any]] = None, db: Optional[str] = None) -> List[Dict[str, Any]]:
        kwargs = self._get_session_kwargs(db)
        driver = self.get_driver()
        try:
            with driver.session(**kwargs) as session:
                result = session.run(query, parameters or {})
                return [record.data() for record in result]
        except Exception as e:
            # If database not found error, retry with default session
            if "DatabaseNotFound" in str(e) or "database does not exist" in str(e):
                logger.warning(f"Neo4j database {kwargs} not found on AuraDB, falling back to default database session")
                with driver.session() as session:
                    result = session.run(query, parameters or {})
                    return [record.data() for record in result]
            raise

    def execute_write(self, cypher_fn, *args, db: Optional[str] = None, **kwargs) -> Any:
        sess_kwargs = self._get_session_kwargs(db)
        driver = self.get_driver()
        try:
            with driver.session(**sess_kwargs) as session:
                return session.execute_write(cypher_fn, *args, **kwargs)
        except Exception as e:
            if "DatabaseNotFound" in str(e) or "database does not exist" in str(e):
                logger.warning(f"Neo4j database {sess_kwargs} not found on AuraDB, falling back to default database session")
                with driver.session() as session:
                    return session.execute_write(cypher_fn, *args, **kwargs)
            raise

neo4j_conn = Neo4jConnection()

