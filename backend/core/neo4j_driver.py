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

    def query(self, query: str, parameters: Optional[Dict[str, Any]] = None, db: Optional[str] = None) -> List[Dict[str, Any]]:
        target_db = db or settings.NEO4J_DATABASE
        driver = self.get_driver()
        with driver.session(database=target_db) as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]

    def execute_write(self, cypher_fn, *args, db: Optional[str] = None, **kwargs) -> Any:
        target_db = db or settings.NEO4J_DATABASE
        driver = self.get_driver()
        with driver.session(database=target_db) as session:
            return session.execute_write(cypher_fn, *args, **kwargs)

neo4j_conn = Neo4jConnection()
