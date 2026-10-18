import os
import sqlite3
import json
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import faiss
from backend.core.logger import logger

class CanonicalStore:
    """
    Sections 3 & 5: Canonical Work Graph & Hybrid Local Storage.
    Maintains:
    1. SQLite database (WAL mode) for scale-invariant hashes, melody contours, and lyrics.
    2. FAISS 128-D index for sub-5ms coarse melody candidate retrieval.
    3. Neo4j graph mapping for (:Recording)-[:IS_VERSION_OF]->(:CanonicalWork).
    """

    DB_PATH = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "hexa_sonic_catalog.db")
    )
    FAISS_DIM = 128

    _conn: Optional[sqlite3.Connection] = None
    _faiss_index: Optional[faiss.IndexFlatIP] = None
    _faiss_track_ids: List[str] = []

    @classmethod
    def get_conn(cls) -> sqlite3.Connection:
        if cls._conn is None:
            os.makedirs(os.path.dirname(cls.DB_PATH), exist_ok=True)
            cls._conn = sqlite3.connect(cls.DB_PATH, check_same_thread=False)
            cls._conn.execute("PRAGMA journal_mode = WAL")
            cls._conn.execute("PRAGMA synchronous = NORMAL")
            cls._init_tables()
        return cls._conn

    @classmethod
    def _init_tables(cls):
        conn = cls._conn
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS canonical_works (
                work_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                artist TEXT NOT NULL,
                iswc TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recordings (
                track_id TEXT PRIMARY KEY,
                work_id TEXT NOT NULL,
                title TEXT NOT NULL,
                artist TEXT NOT NULL,
                is_original_master INTEGER DEFAULT 1,
                popularity REAL DEFAULT 0.8,
                preview_url TEXT,
                youtube_url TEXT,
                thumbnail TEXT,
                duration_sec REAL DEFAULT 180.0,
                FOREIGN KEY (work_id) REFERENCES canonical_works(work_id)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS constellation_hashes (
                hash_val INTEGER NOT NULL,
                track_id TEXT NOT NULL,
                time_sec REAL NOT NULL
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hash_val ON constellation_hashes(hash_val)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hash_track ON constellation_hashes(track_id)")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS melody_contours (
                track_id TEXT PRIMARY KEY,
                dp_blob BLOB NOT NULL,
                ioi_blob BLOB NOT NULL,
                num_notes INTEGER NOT NULL,
                coarse_vec_blob BLOB
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lyrics_index (
                track_id TEXT PRIMARY KEY,
                plain_lyrics TEXT NOT NULL,
                phonetic_skeleton TEXT NOT NULL
            )
        """)
        conn.commit()

    @classmethod
    def get_faiss_index(cls) -> faiss.IndexFlatIP:
        if cls._faiss_index is None:
            cls._faiss_index = faiss.IndexFlatIP(cls.FAISS_DIM)
            cls._load_faiss_from_db()
        return cls._faiss_index

    @classmethod
    def _load_faiss_from_db(cls):
        conn = cls.get_conn()
        cursor = conn.cursor()
        rows = cursor.execute("SELECT track_id, coarse_vec_blob FROM melody_contours WHERE coarse_vec_blob IS NOT NULL").fetchall()
        if rows:
            vecs = []
            cls._faiss_track_ids = []
            for tid, blob in rows:
                v = np.frombuffer(blob, dtype=np.float32)
                if len(v) == cls.FAISS_DIM:
                    vecs.append(v)
                    cls._faiss_track_ids.append(tid)
            if vecs:
                matrix = np.vstack(vecs).astype(np.float32)
                cls._faiss_index.add(matrix)
                logger.info(f"CanonicalStore: Loaded {len(vecs)} melody vectors into FAISS index")

    @classmethod
    def add_canonical_song(
        cls,
        track_id: str,
        title: str,
        artist: str,
        work_id: Optional[str] = None,
        is_original_master: bool = True,
        popularity: float = 0.8,
        preview_url: Optional[str] = None,
        youtube_url: Optional[str] = None,
        thumbnail: Optional[str] = None,
        triplet_hashes: Optional[List[Tuple[int, float]]] = None,
        dp: Optional[np.ndarray] = None,
        r_ioi: Optional[np.ndarray] = None,
        coarse_vec: Optional[np.ndarray] = None,
        plain_lyrics: Optional[str] = None,
        phonetic_skeleton: Optional[str] = None
    ):
        """Indexes a song across Canonical Works, Constellation Hashes, Melody Contours, and Lyrics."""
        conn = cls.get_conn()
        cursor = conn.cursor()

        w_id = work_id or f"work:{title.lower().strip()}:{artist.lower().strip()}"
        cursor.execute(
            "INSERT OR IGNORE INTO canonical_works (work_id, title, artist) VALUES (?, ?, ?)",
            (w_id, title, artist)
        )
        cursor.execute(
            """
            INSERT OR REPLACE INTO recordings 
            (track_id, work_id, title, artist, is_original_master, popularity, preview_url, youtube_url, thumbnail)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (track_id, w_id, title, artist, 1 if is_original_master else 0, popularity, preview_url, youtube_url, thumbnail)
        )

        if triplet_hashes:
            cursor.execute("DELETE FROM constellation_hashes WHERE track_id = ?", (track_id,))
            rows = [(h, track_id, t) for h, t in triplet_hashes]
            cursor.executemany("INSERT INTO constellation_hashes (hash_val, track_id, time_sec) VALUES (?, ?, ?)", rows)

        if dp is not None and r_ioi is not None and len(dp) > 0:
            dp_blob = dp.astype(np.float32).tobytes()
            ioi_blob = r_ioi.astype(np.float32).tobytes()
            vec_blob = coarse_vec.astype(np.float32).tobytes() if coarse_vec is not None else None
            cursor.execute(
                """
                INSERT OR REPLACE INTO melody_contours 
                (track_id, dp_blob, ioi_blob, num_notes, coarse_vec_blob)
                VALUES (?, ?, ?, ?, ?)
                """,
                (track_id, dp_blob, ioi_blob, len(dp), vec_blob)
            )
            # Add to live FAISS index
            if coarse_vec is not None and len(coarse_vec) == cls.FAISS_DIM:
                faiss_idx = cls.get_faiss_index()
                faiss_idx.add(np.expand_dims(coarse_vec.astype(np.float32), axis=0))
                cls._faiss_track_ids.append(track_id)

        if plain_lyrics:
            p_skel = phonetic_skeleton or plain_lyrics
            cursor.execute(
                "INSERT OR REPLACE INTO lyrics_index (track_id, plain_lyrics, phonetic_skeleton) VALUES (?, ?, ?)",
                (track_id, plain_lyrics, p_skel)
            )

        conn.commit()

        # Sync with Neo4j CanonicalWork hierarchy if available
        try:
            from backend.core.neo4j_driver import neo4j_conn
            neo4j_conn.query(
                """
                MERGE (w:CanonicalWork {work_id: $work_id})
                ON CREATE SET w.title = $title, w.artist = $artist
                MERGE (r:Recording {track_id: $track_id})
                SET r.title = $title,
                    r.artist = $artist,
                    r.is_original_master = $is_original_master,
                    r.global_popularity_score = $popularity,
                    r.preview_url = $preview_url,
                    r.youtube_url = $youtube_url
                MERGE (r)-[:IS_VERSION_OF]->(w)
                """,
                {
                    "work_id": w_id,
                    "track_id": track_id,
                    "title": title,
                    "artist": artist,
                    "is_original_master": is_original_master,
                    "popularity": popularity,
                    "preview_url": preview_url or "",
                    "youtube_url": youtube_url or ""
                }
            )
        except Exception as e:
            logger.debug(f"CanonicalStore: Neo4j sync note: {e}")

    @classmethod
    def lookup_constellation_hashes(cls, hashes: List[int]) -> Dict[int, List[Tuple[str, float]]]:
        """Queries inverted hash index for Stream A."""
        if not hashes:
            return {}
        conn = cls.get_conn()
        cursor = conn.cursor()

        # Batch query in chunks of 500
        result: Dict[int, List[Tuple[str, float]]] = {}
        chunk_size = 500
        for i in range(0, len(hashes), chunk_size):
            chunk = hashes[i : i + chunk_size]
            placeholders = ",".join(["?"] * len(chunk))
            rows = cursor.execute(
                f"SELECT hash_val, track_id, time_sec FROM constellation_hashes WHERE hash_val IN ({placeholders})",
                chunk
            ).fetchall()
            for h, tid, t in rows:
                if h not in result:
                    result[h] = []
                result[h].append((tid, t))
        return result

    @classmethod
    def query_melody_candidates(cls, query_vec: np.ndarray, top_k: int = 50) -> List[Tuple[str, float]]:
        """Fast FAISS search for Top K coarse melody candidates."""
        if cls._faiss_index is None or cls._faiss_index.ntotal == 0:
            cls.get_faiss_index()

        if cls._faiss_index.ntotal == 0 or len(cls._faiss_track_ids) == 0:
            # Fallback to returning all recordings from DB if FAISS is small
            conn = cls.get_conn()
            cursor = conn.cursor()
            rows = cursor.execute("SELECT track_id FROM melody_contours LIMIT ?", (top_k,)).fetchall()
            return [(r[0], 0.5) for r in rows]

        k = min(top_k, cls._faiss_index.ntotal)
        q = np.expand_dims(query_vec.astype(np.float32), axis=0)
        sims, indices = cls._faiss_index.search(q, k)

        results = []
        for sim, idx in zip(sims[0], indices[0]):
            if 0 <= idx < len(cls._faiss_track_ids):
                tid = cls._faiss_track_ids[idx]
                results.append((tid, float(sim)))
        return results

    @classmethod
    def get_melody_contour(cls, track_id: str) -> Optional[Tuple[np.ndarray, np.ndarray]]:
        conn = cls.get_conn()
        cursor = conn.cursor()
        row = cursor.execute("SELECT dp_blob, ioi_blob FROM melody_contours WHERE track_id = ?", (track_id,)).fetchone()
        if row:
            dp = np.frombuffer(row[0], dtype=np.float32)
            ioi = np.frombuffer(row[1], dtype=np.float32)
            return dp, ioi
        return None

    @classmethod
    def get_recording_info(cls, track_id: str) -> Optional[Dict[str, Any]]:
        conn = cls.get_conn()
        cursor = conn.cursor()
        row = cursor.execute(
            """
            SELECT r.track_id, r.work_id, r.title, r.artist, r.is_original_master, 
                   r.popularity, r.preview_url, r.youtube_url, r.thumbnail
            FROM recordings r WHERE r.track_id = ?
            """,
            (track_id,)
        ).fetchone()
        if row:
            return {
                "track_id": row[0],
                "work_id": row[1],
                "title": row[2],
                "artist": row[3],
                "is_original_master": bool(row[4]),
                "popularity": float(row[5]),
                "preview_url": row[6],
                "youtube_url": row[7],
                "thumbnail": row[8]
            }
        return None

    @classmethod
    def get_all_lyrics(cls) -> List[Tuple[str, str, str]]:
        """Returns list of (track_id, plain_lyrics, phonetic_skeleton) for lyric search."""
        conn = cls.get_conn()
        cursor = conn.cursor()
        return cursor.execute("SELECT track_id, plain_lyrics, phonetic_skeleton FROM lyrics_index").fetchall()

    @classmethod
    def get_lyrics_for_track(cls, track_id: str) -> Optional[str]:
        """Returns plain lyrics string for a specific track ID."""
        conn = cls.get_conn()
        cursor = conn.cursor()
        row = cursor.execute("SELECT plain_lyrics FROM lyrics_index WHERE track_id = ?", (track_id,)).fetchone()
        return row[0] if row else None

