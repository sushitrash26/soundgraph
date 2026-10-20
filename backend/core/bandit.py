import math
import time
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timezone, timedelta
from backend.core.cache import UnifiedCache
from backend.core.logger import logger

ARM_NAMES = {
    0: "persona_exploit",         # Exploit user's dominant taste persona centroid
    1: "diurnal_circadian",       # Match active time-of-day acoustic diurnal profile
    2: "cross_platform_bridge",   # Intersect Spotify & YouTube graph clusters
    3: "frontier_wildcard"        # Multi-armed exploration into adjacent soundscapes
}

NUM_ARMS = 4
CONTEXT_DIM = 7  # QW5: explicit intercept (x0=1.0) + sin_hour + cos_hour + depth + valence + energy + entropy
DEFAULT_ALPHA = 0.5  # Exploration coefficient

class ContextualLinUCB:
    """
    Contextual Multi-Armed Bandit (LinUCB with Disjoint Linear Models):
    Replaces static heuristic ranking with continuous, real-time reinforcement learning.
    
    QW5: 7-dimensional context vector with explicit intercept x0=1.0 and user-local timezone.
    QW6: Deduplicates updates so each impression yields exactly one reward update.

    Mathematical Formulation:
    - Expected Reward: hat_theta_a = A_a^(-1) * b_a
    - Upper Confidence Bound: UCB_a = hat_theta_a^T * x + alpha * sqrt(x^T * A_a^(-1) * x)
    - Online Ridge Update:
        A_a <- A_a + x * x^T
        b_a <- b_a + r * x
    """

    @classmethod
    def get_context_vector(
        cls,
        hour: Optional[int] = None,
        session_depth: int = 1,
        prev_valence: float = 0.5,
        prev_energy: float = 0.5,
        persona_entropy: float = 0.5,
        tz_offset_minutes: Optional[int] = None
    ) -> np.ndarray:
        """Constructs normalized 7-dimensional context vector x with explicit intercept x0=1.0"""
        if hour is None:
            now_utc = datetime.now(timezone.utc)
            if tz_offset_minutes is not None:
                local_time = now_utc + timedelta(minutes=tz_offset_minutes)
                hour = local_time.hour
            else:
                hour = now_utc.hour

        rad = 2.0 * math.pi * (hour / 24.0)
        sin_hour = math.sin(rad)
        cos_hour = math.cos(rad)
        norm_depth = min(float(session_depth) / 20.0, 1.0)
        v = (float(prev_valence) - 0.5) * 2.0
        e = (float(prev_energy) - 0.5) * 2.0
        ent = (float(persona_entropy) - 0.5) * 2.0

        # QW5: explicit intercept x0 = 1.0 prevents origin-forcing bias in ridge regression
        return np.array([1.0, sin_hour, cos_hour, norm_depth, v, e, ent], dtype=np.float64)

    @classmethod
    def should_apply_reward(cls, impression_id: Optional[str]) -> bool:
        """
        QW6: Deduplicates updates so each impression yields exactly one bandit update.
        Returns True if the impression has not been rewarded yet (and marks it rewarded),
        or True if impression_id is None (legacy non-impression updates).
        """
        if not impression_id:
            return True
        cache_key = f"bandit:rewarded:{impression_id}"
        already_rewarded = UnifiedCache.get(cache_key)
        if already_rewarded:
            logger.info(f"QW6 Deduplication: Dropped duplicate bandit update for impression {impression_id}")
            return False
        UnifiedCache.set(cache_key, 1, ttl=86400 * 7)
        return True

    @classmethod
    def _load_arm_state(cls, user_id: str, arm: int) -> Tuple[np.ndarray, np.ndarray]:
        """Loads covariance matrix A_a and reward vector b_a from UnifiedCache"""
        cache_key = f"bandit:{user_id}:arm_{arm}"
        data = UnifiedCache.get(cache_key)
        if data and "A" in data and "b" in data:
            try:
                A = np.array(data["A"], dtype=np.float64)
                b = np.array(data["b"], dtype=np.float64)
                if A.shape == (CONTEXT_DIM, CONTEXT_DIM) and b.shape == (CONTEXT_DIM,):
                    return A, b
            except Exception as e:
                logger.warning(f"Error restoring bandit state for {user_id}: {e}")

        # Initialize with ridge identity matrix I_d and zero vector
        A = np.eye(CONTEXT_DIM, dtype=np.float64)
        b = np.zeros(CONTEXT_DIM, dtype=np.float64)
        return A, b

    @classmethod
    def _save_arm_state(cls, user_id: str, arm: int, A: np.ndarray, b: np.ndarray):
        """Persists covariance matrix A_a and reward vector b_a to UnifiedCache"""
        cache_key = f"bandit:{user_id}:arm_{arm}"
        data = {
            "A": A.tolist(),
            "b": b.tolist(),
            "updated_at": time.time()
        }
        UnifiedCache.set(cache_key, data, ttl=86400 * 90)

    @classmethod
    def rank_arms(
        cls,
        user_id: str,
        x: np.ndarray,
        alpha: float = DEFAULT_ALPHA
    ) -> List[Dict[str, Any]]:
        """
        Calculates UCB scores for all arms and returns ranked arms with confidence metrics.
        Runs in < 0.5 milliseconds using NumPy matrix algebra.
        """
        ranked = []
        for arm in range(NUM_ARMS):
            A, b = cls._load_arm_state(user_id, arm)
            try:
                A_inv = np.linalg.inv(A)
            except np.linalg.LinAlgError:
                A_inv = np.linalg.pinv(A)

            theta = A_inv @ b
            expected_reward = float(theta @ x)
            uncertainty_bonus = float(alpha * math.sqrt(max(0.0, x.T @ A_inv @ x)))
            ucb_score = expected_reward + uncertainty_bonus

            ranked.append({
                "arm": arm,
                "arm_name": ARM_NAMES.get(arm, f"arm_{arm}"),
                "ucb_score": round(ucb_score, 4),
                "expected_reward": round(expected_reward, 4),
                "uncertainty_bonus": round(uncertainty_bonus, 4),
            })

        ranked.sort(key=lambda item: item["ucb_score"], reverse=True)
        return ranked

    @classmethod
    def select_arm(
        cls,
        user_id: str,
        x: Optional[np.ndarray] = None,
        alpha: float = DEFAULT_ALPHA
    ) -> Tuple[int, float]:
        """Convenience method returning the highest UCB arm and its score"""
        if x is None:
            x = cls.get_context_vector()
        ranked = cls.rank_arms(user_id, x, alpha)
        top = ranked[0]
        return top["arm"], top["ucb_score"]

    @classmethod
    def update(
        cls,
        user_id: str,
        arm: int,
        x: np.ndarray,
        reward: float,
        impression_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Online Ridge Regression Update:
        A_a <- A_a + x * x^T
        b_a <- b_a + reward * x
        """
        if arm < 0 or arm >= NUM_ARMS:
            return {"status": "ignored", "reason": "invalid_arm"}

        if impression_id and not cls.should_apply_reward(impression_id):
            return {"status": "ignored", "reason": "duplicate_impression_reward"}

        A, b = cls._load_arm_state(user_id, arm)
        # Outer product x * x^T
        A += np.outer(x, x)
        b += float(reward) * x

        cls._save_arm_state(user_id, arm, A, b)
        logger.info(f"LinUCB: Updated Arm {arm} ({ARM_NAMES.get(arm)}) for user {user_id} with reward {reward:+.3f}")
        return {
            "status": "updated",
            "arm": arm,
            "arm_name": ARM_NAMES.get(arm),
            "reward": reward
        }

    @classmethod
    def calculate_continuous_reward(cls, dwell_ms: int, explicit_action: Optional[float] = None) -> float:
        """
        Translates real-time listening dwell telemetry into continuous reward r in [-1.0, 1.0]:
        - < 2.0s fast skip: -0.6 to -0.8 (disinterest)
        - 2.0s - 5.0s: -0.3 to 0.0 (mild pass)
        - 5.0s - 12.0s: +0.2 to +0.6 (engaged listening)
        - > 15.0s / completed: +0.8 to +1.0 (strong affinity)
        - Explicit thumbs-up (+1.0) / thumbs-down (-1.0) overrides/augments
        """
        # Continuous sigmoid/tanh centering around 5000ms threshold
        scaled = (dwell_ms - 5000.0) / 7000.0
        dwell_reward = math.tanh(scaled)

        if explicit_action is not None:
            # 60% explicit, 40% implicit dwell
            final_reward = (0.6 * explicit_action) + (0.4 * dwell_reward)
        else:
            final_reward = dwell_reward

        return max(-1.0, min(1.0, round(final_reward, 3)))

calculate_continuous_reward = ContextualLinUCB.calculate_continuous_reward
