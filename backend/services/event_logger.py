import sqlite3
import json
import os
import time
import uuid
import datetime
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor
from backend.core.logger import logger

DB_PATH = os.path.join(os.path.dirname(__file__), "../data/soundgraph_events.db")

class EventLogger:
    _instance: Optional["EventLogger"] = None
    _executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="event_logger")

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    @classmethod
    def get_instance(cls) -> "EventLogger":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            conn.executescript("""
            CREATE TABLE IF NOT EXISTS requests (
                request_id          TEXT PRIMARY KEY,
                user_id             TEXT NOT NULL,
                endpoint            TEXT NOT NULL,
                params              TEXT,
                candidate_counts    TEXT,
                candidate_snapshot  TEXT,
                model_version       TEXT,
                embedding_version   TEXT,
                config_version      TEXT,
                experiment_id       TEXT,
                latency_ms          INTEGER,
                served_at           TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS impressions (
                impression_id       TEXT PRIMARY KEY,
                request_id          TEXT NOT NULL,
                user_id             TEXT NOT NULL,
                track_id            TEXT NOT NULL,
                position            INTEGER NOT NULL,
                arm                 INTEGER,
                source              TEXT,
                rank_in_source      INTEGER,
                score_raw           REAL,
                score_fused         REAL,
                propensity          REAL,
                context             TEXT,
                preview_ok          INTEGER DEFAULT 1,
                served_at           TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (request_id) REFERENCES requests(request_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS events (
                event_id            TEXT PRIMARY KEY,
                impression_id       TEXT,
                user_id             TEXT NOT NULL,
                track_id            TEXT NOT NULL,
                type                TEXT NOT NULL,
                value_ms            INTEGER,
                client_ts           TEXT,
                server_ts           TEXT DEFAULT (datetime('now')),
                app_version         TEXT,
                FOREIGN KEY (impression_id) REFERENCES impressions(impression_id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_requests_user ON requests(user_id, served_at);
            CREATE INDEX IF NOT EXISTS idx_impressions_user ON impressions(user_id, served_at);
            CREATE INDEX IF NOT EXISTS idx_impressions_req ON impressions(request_id);
            CREATE INDEX IF NOT EXISTS idx_events_imp ON events(impression_id);
            CREATE INDEX IF NOT EXISTS idx_events_user_type ON events(user_id, type);
            """)

    def _sync_log_request_and_impressions(self, req: Dict[str, Any], impressions: List[Dict[str, Any]]):
        try:
            with self._get_connection() as conn:
                conn.execute("""
                INSERT INTO requests (
                    request_id, user_id, endpoint, params, candidate_counts, 
                    candidate_snapshot, model_version, embedding_version, 
                    config_version, experiment_id, latency_ms, served_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                """, (
                    req.get("request_id"),
                    req.get("user_id"),
                    req.get("endpoint", "/recommendations"),
                    json.dumps(req.get("params", {})),
                    json.dumps(req.get("candidate_counts", {})),
                    json.dumps(req.get("candidate_snapshot", [])),
                    req.get("model_version", "1.0.0"),
                    req.get("embedding_version", "gemini-2"),
                    req.get("config_version", "1.0.0"),
                    req.get("experiment_id", "baseline"),
                    req.get("latency_ms", 0)
                ))

                imp_tuples = []
                for imp in impressions:
                    imp_tuples.append((
                        imp.get("impression_id"),
                        req.get("request_id"),
                        imp.get("user_id"),
                        imp.get("track_id"),
                        imp.get("position", 0),
                        imp.get("arm", 0),
                        imp.get("source", "persona_text"),
                        imp.get("rank_in_source", 0),
                        imp.get("score_raw", 0.0),
                        imp.get("score_fused", 0.0),
                        imp.get("propensity"),
                        json.dumps(imp.get("context", [])),
                        1 if imp.get("preview_ok", True) else 0
                    ))

                conn.executemany("""
                INSERT INTO impressions (
                    impression_id, request_id, user_id, track_id, position, arm,
                    source, rank_in_source, score_raw, score_fused, propensity,
                    context, preview_ok, served_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                """, imp_tuples)
        except Exception as e:
            logger.error(f"EventLogger: Failed to log request and impressions: {e}")

    def log_request_and_impressions_async(self, req: Dict[str, Any], impressions: List[Dict[str, Any]]):
        """Asynchronously writes request and impression records off the critical serving path."""
        self._executor.submit(self._sync_log_request_and_impressions, req, impressions)

    def log_events(self, events: List[Dict[str, Any]]) -> int:
        """Idempotent batch insertion of client events."""
        if not events:
            return 0
        inserted = 0
        try:
            with self._get_connection() as conn:
                event_tuples = []
                for ev in events:
                    eid = ev.get("event_id") or str(uuid.uuid4())
                    event_tuples.append((
                        eid,
                        ev.get("impression_id"),
                        ev.get("user_id"),
                        ev.get("track_id"),
                        ev.get("type"),
                        ev.get("value_ms"),
                        ev.get("client_ts") or datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        ev.get("app_version", "1.0.0")
                    ))
                cur = conn.executemany("""
                INSERT OR IGNORE INTO events (
                    event_id, impression_id, user_id, track_id, type, value_ms, client_ts, server_ts, app_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
                """, event_tuples)
                inserted = cur.rowcount
        except Exception as e:
            logger.error(f"EventLogger: Failed to log events: {e}")
        return inserted

    def get_impression(self, impression_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM impressions WHERE impression_id = ?", (impression_id,)).fetchone()
            if row:
                d = dict(row)
                d["context"] = json.loads(d["context"]) if d["context"] else []
                return d
        return None

    def get_deck_by_request_id(self, request_id: str) -> Dict[str, Any]:
        with self._get_connection() as conn:
            req_row = conn.execute("SELECT * FROM requests WHERE request_id = ?", (request_id,)).fetchone()
            if not req_row:
                return {}
            imp_rows = conn.execute("SELECT * FROM impressions WHERE request_id = ? ORDER BY position ASC", (request_id,)).fetchall()
            impressions = [dict(r) for r in imp_rows]
            for imp in impressions:
                imp["context"] = json.loads(imp["context"]) if imp["context"] else []
            req_dict = dict(req_row)
            req_dict["candidate_counts"] = json.loads(req_dict["candidate_counts"]) if req_dict["candidate_counts"] else {}
            req_dict["candidate_snapshot"] = json.loads(req_dict["candidate_snapshot"]) if req_dict["candidate_snapshot"] else []
            req_dict["impressions"] = impressions
            return req_dict

    def delete_user_data(self, user_id: str) -> int:
        """Cascade deletes all requests, impressions, and events for a user."""
        try:
            with self._get_connection() as conn:
                # With foreign keys ON, deleting requests cascades to impressions and events with matching impression_id
                cur = conn.execute("DELETE FROM requests WHERE user_id = ?", (user_id,))
                # Also delete orphan events that may not have had an impression_id
                conn.execute("DELETE FROM events WHERE user_id = ?", (user_id,))
                return cur.rowcount
        except Exception as e:
            logger.error(f"EventLogger: Failed to delete data for user {user_id}: {e}")
            return 0
