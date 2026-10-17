import json
import sqlite3
import os
import time
from typing import Any, Optional, Dict
from pathlib import Path
from redis import Redis
from backend.core.config import settings
from backend.core.logger import logger

class UnifiedCache:
    """
    Production-grade Unified Distributed Cache:
    1. Connects to Redis (Upstash Cloud or Local Redis).
    2. Tests write permission.
    3. If Redis is read-only or offline, automatically falls back to local Redis (redis://localhost:6379/0)
       or persistent local SQLite storage (backend/data/cache.db).
    Zero downtime, zero blockers.
    """
    _redis_client: Optional[Redis] = None
    _is_redis_ready: bool = False
    _sqlite_path: Path = Path(__file__).resolve().parent.parent / "data" / "cache.db"

    @classmethod
    def _init_sqlite(cls):
        cls._sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(cls._sqlite_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS kv_cache (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    expires_at REAL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_expires ON kv_cache(expires_at)")

    @classmethod
    def get_redis(cls) -> Optional[Redis]:
        if cls._redis_client is not None and cls._is_redis_ready:
            return cls._redis_client

        redis_urls = []
        configured_url = getattr(settings, "REDIS_URL", None) or os.getenv("REDIS_URL")
        if configured_url:
            redis_urls.append(("Configured REDIS_URL", configured_url.strip('"').strip("'")))
        redis_urls.append(("Local Redis", "redis://localhost:6379/0"))

        for name, url in redis_urls:
            try:
                client = Redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
                # Test write capability
                test_key = f"_health_check:{int(time.time())}"
                client.set(test_key, "ok", ex=5)
                client.delete(test_key)
                cls._redis_client = client
                cls._is_redis_ready = True
                logger.info(f"UnifiedCache: Connected to {name} successfully.")
                return cls._redis_client
            except Exception as e:
                logger.warning(f"UnifiedCache: {name} failed or is read-only ({e}). Trying next option...")

        logger.info("UnifiedCache: Falling back to persistent SQLite cache at backend/data/cache.db")
        cls._init_sqlite()
        cls._is_redis_ready = False
        return None

    @classmethod
    def get(cls, key: str) -> Optional[Any]:
        r = cls.get_redis()
        if r:
            try:
                val = r.get(key)
                if val is not None:
                    try:
                        return json.loads(val)
                    except Exception:
                        return val
                return None
            except Exception as e:
                logger.warning(f"UnifiedCache Redis get error for {key}: {e}")

        # SQLite fallback
        try:
            cls._init_sqlite()
            now = time.time()
            with sqlite3.connect(cls._sqlite_path) as conn:
                row = conn.execute("SELECT value, expires_at FROM kv_cache WHERE key = ?", (key,)).fetchone()
                if row:
                    val, exp = row
                    if exp and exp < now:
                        conn.execute("DELETE FROM kv_cache WHERE key = ?", (key,))
                        return None
                    try:
                        return json.loads(val)
                    except Exception:
                        return val
        except Exception as e:
            logger.error(f"UnifiedCache SQLite get error: {e}")
        return None

    @classmethod
    def set(cls, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        serialized = json.dumps(value) if not isinstance(value, str) else value
        r = cls.get_redis()
        if r:
            try:
                if ttl:
                    r.set(key, serialized, ex=ttl)
                else:
                    r.set(key, serialized)
                return True
            except Exception as e:
                logger.warning(f"UnifiedCache Redis set error for {key}: {e}")

        # SQLite fallback
        try:
            cls._init_sqlite()
            expires_at = time.time() + ttl if ttl else None
            with sqlite3.connect(cls._sqlite_path) as conn:
                conn.execute("""
                    INSERT INTO kv_cache (key, value, expires_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
                """, (key, serialized, expires_at))
            return True
        except Exception as e:
            logger.error(f"UnifiedCache SQLite set error: {e}")
            return False

    @classmethod
    def delete(cls, key: str) -> bool:
        r = cls.get_redis()
        if r:
            try:
                r.delete(key)
            except Exception:
                pass
        try:
            cls._init_sqlite()
            with sqlite3.connect(cls._sqlite_path) as conn:
                conn.execute("DELETE FROM kv_cache WHERE key = ?", (key,))
            return True
        except Exception:
            return False

    @classmethod
    def hset(cls, name: str, key: str, value: Any):
        serialized = json.dumps(value) if not isinstance(value, str) else value
        r = cls.get_redis()
        if r:
            try:
                r.hset(name, key, serialized)
                return
            except Exception:
                pass
        # SQLite composite key fallback
        cls.set(f"hash:{name}:{key}", serialized)

    @classmethod
    def hget(cls, name: str, key: str) -> Optional[Any]:
        r = cls.get_redis()
        if r:
            try:
                val = r.hget(name, key)
                if val is not None:
                    try:
                        return json.loads(val)
                    except Exception:
                        return val
            except Exception:
                pass
        return cls.get(f"hash:{name}:{key}")

    @classmethod
    def hgetall(cls, name: str) -> Dict[str, Any]:
        r = cls.get_redis()
        if r:
            try:
                raw = r.hgetall(name)
                res = {}
                for k, v in raw.items():
                    try:
                        res[k] = json.loads(v)
                    except Exception:
                        res[k] = v
                return res
            except Exception:
                pass

        # SQLite fallback
        cls._init_sqlite()
        prefix = f"hash:{name}:"
        res = {}
        with sqlite3.connect(cls._sqlite_path) as conn:
            rows = conn.execute("SELECT key, value FROM kv_cache WHERE key LIKE ?", (f"{prefix}%",)).fetchall()
            for k, v in rows:
                field = k[len(prefix):]
                try:
                    res[field] = json.loads(v)
                except Exception:
                    res[field] = v
        return res
