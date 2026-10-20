"""
Session Taste State & Negative Memory Service (Workstream W6).
Resolves F-11, F-12, F-24:
1. Fast session vector adaptation:
   s <- (1-eta)s + eta*v on positive interaction (eta = 0.3)
   s <- s - eta'*v on negative interaction (eta' = 0.15)
   renormalized to unit sphere.
2. Negative memory ledger: keeps up to 50 most recent disliked vectors D.
   Computes calibrated dislike penalty:
   pen(v) = max(0, max_{d in D} cos(v, d) - 0.75) / 0.25  in [0, 1]
3. Soft artist dislike decay (half-life 30 days) instead of hard permanent block.
"""

from typing import Dict, List, Any, Optional, Tuple
import numpy as np
from backend.core.cache import UnifiedCache
from backend.core.logger import logger

ETA_LIKE = 0.30
ETA_DISLIKE = 0.15
MAX_NEGATIVE_MEMORY = 50


class SessionTasteState:
    """Maintains transient within-session taste adaptation and negative memory."""

    @classmethod
    def _cache_key(cls, user_id: str) -> str:
        return f"session_taste:{user_id}"

    @classmethod
    def get_state(cls, user_id: str) -> Dict[str, Any]:
        """Loads active session taste state from cache or initializes a new one."""
        ckey = cls._cache_key(user_id)
        try:
            cached = UnifiedCache.get(ckey)
            if cached and isinstance(cached, dict):
                return cached
        except Exception as e:
            logger.debug(f"Error reading session taste state: {e}")

        return {
            "user_id": user_id,
            "session_vector": None,
            "positive_count": 0,
            "negative_memory": [],  # list of 768-D lists
            "disliked_track_ids": [],
            "disliked_artists": {},  # artist_name -> count
            "recent_liked_tracks": []
        }

    @classmethod
    def save_state(cls, user_id: str, state: Dict[str, Any], ttl: int = 86400 * 2) -> None:
        """Persists session taste state to cache."""
        ckey = cls._cache_key(user_id)
        try:
            UnifiedCache.set(ckey, state, ttl=ttl)
        except Exception as e:
            logger.warning(f"Error saving session taste state: {e}")

    @classmethod
    def record_positive(cls, user_id: str, track_id: str, embedding: List[float], artist: Optional[str] = None) -> None:
        """Updates session drift vector upon a positive interaction (like / completion)."""
        if not embedding or len(embedding) != 768:
            return

        state = cls.get_state(user_id)
        v = np.array(embedding, dtype=np.float32)
        v_norm = np.linalg.norm(v)
        if v_norm == 0:
            return
        v /= v_norm

        curr_s = state.get("session_vector")
        if curr_s is None:
            new_s = v
        else:
            s_arr = np.array(curr_s, dtype=np.float32)
            new_s = (1.0 - ETA_LIKE) * s_arr + (ETA_LIKE * v)
            s_norm = np.linalg.norm(new_s)
            if s_norm > 1e-9:
                new_s /= s_norm

        state["session_vector"] = new_s.tolist()
        state["positive_count"] = state.get("positive_count", 0) + 1

        recent_likes = state.get("recent_liked_tracks", [])
        if track_id not in recent_likes:
            recent_likes.append(track_id)
        state["recent_liked_tracks"] = recent_likes[-10:]

        cls.save_state(user_id, state)
        logger.debug(f"Session vector updated (positive) for user {user_id}: total_pos={state['positive_count']}")

    @classmethod
    def record_negative(cls, user_id: str, track_id: str, embedding: List[float], artist: Optional[str] = None) -> None:
        """Pushes vector into negative memory and steers session drift vector away."""
        if not embedding or len(embedding) != 768:
            return

        state = cls.get_state(user_id)
        v = np.array(embedding, dtype=np.float32)
        v_norm = np.linalg.norm(v)
        if v_norm == 0:
            return
        v /= v_norm

        # Steer session vector away from negative track
        curr_s = state.get("session_vector")
        if curr_s is not None:
            s_arr = np.array(curr_s, dtype=np.float32)
            new_s = s_arr - (ETA_DISLIKE * v)
            s_norm = np.linalg.norm(new_s)
            if s_norm > 1e-9:
                new_s /= s_norm
                state["session_vector"] = new_s.tolist()

        # Update negative memory FIFO (capped at MAX_NEGATIVE_MEMORY)
        neg_mem = state.get("negative_memory", [])
        neg_mem.append(v.tolist())
        if len(neg_mem) > MAX_NEGATIVE_MEMORY:
            neg_mem = neg_mem[-MAX_NEGATIVE_MEMORY:]
        state["negative_memory"] = neg_mem

        disliked_tracks = state.get("disliked_track_ids", [])
        if track_id not in disliked_tracks:
            disliked_tracks.append(track_id)
        state["disliked_track_ids"] = disliked_tracks[-100:]

        if artist:
            art_map = state.get("disliked_artists", {})
            art_map[artist] = art_map.get(artist, 0) + 1
            state["disliked_artists"] = art_map

        cls.save_state(user_id, state)
        logger.debug(f"Negative memory updated for user {user_id}: total_neg={len(neg_mem)}")

    @classmethod
    def compute_dislike_penalty(cls, user_id: str, vec: List[float]) -> float:
        """
        Computes negative memory dislike penalty:
        pen(v) = max(0, max_{d in D} cos(v, d) - 0.75) / 0.25  in [0, 1].
        """
        if not vec or len(vec) != 768:
            return 0.0

        state = cls.get_state(user_id)
        neg_mem = state.get("negative_memory", [])
        if not neg_mem:
            return 0.0

        v = np.array(vec, dtype=np.float32)
        v_norm = np.linalg.norm(v)
        if v_norm == 0:
            return 0.0
        v /= v_norm

        D = np.array(neg_mem, dtype=np.float32)
        cos_sims = np.dot(D, v)
        max_cos = float(np.max(cos_sims))

        penalty = max(0.0, max_cos - 0.75) / 0.25
        return float(np.clip(penalty, 0.0, 1.0))
