"""
Pointwise Multi-Signal Ranker (Workstream W8 Phase 1).
Resolves F-07 and F-32:
Provides a single, calibrated, explainable scoring stage between candidate generation and deck assembly.
Combines 8 distinct signals without arbitrary waterfall sort rules:
1. sim_persona: max cosine similarity across persona centroids and medoids, weighted by mass.
2. sim_session: cosine similarity to tracks liked in this session.
3. pop_pct: normalized track popularity [0, 1].
4. novelty: 1.0 - max cosine similarity to user's listened history.
5. mood_match: calibrated soft Euclidean proximity to mood target, weighted by feature_confidence.
6. source_prior: studio quality prior (1.0 for iTunes/Deezer verified).
7. dislike_penalty: negative memory repulsion from recently disliked vectors.
8. preview_conf_discount: discount based on preview match confidence.
"""

from typing import Dict, List, Any, Optional, Tuple
import numpy as np
from backend.services.session_state import SessionTasteState
from backend.core.logger import logger

# Calibrated mood target coordinates (valence, energy)
MOOD_TARGETS = {
    "euphoric": (0.80, 0.75),
    "melancholic": (0.25, 0.35),
    "chill": (0.55, 0.30),
    "high_energy": (0.60, 0.85)
}


class PointwiseRanker:
    """Computes transparent, multi-signal relevance scores for recommendation candidates."""

    @classmethod
    def compute_mood_affinity(
        cls, 
        track: Dict[str, Any], 
        requested_mood: Optional[str]
    ) -> float:
        """
        Calibrated soft mood score weighted by feature_confidence (F-32).
        Returns soft match in [0, 1].
        """
        if not requested_mood or requested_mood.lower() not in MOOD_TARGETS:
            return 0.0

        target_v, target_e = MOOD_TARGETS[requested_mood.lower()]
        track_v = float(track.get("valence", 0.50) or 0.50)
        track_e = float(track.get("energy", 0.50) or 0.50)
        conf = float(track.get("feature_confidence", 0.65) or 0.65)

        # Normalized Euclidean distance in (valence, energy) space
        dist = np.sqrt((track_v - target_v) ** 2 + (track_e - target_e) ** 2)
        raw_match = max(0.0, 1.0 - (1.2 * dist))
        return float(raw_match * conf)

    @classmethod
    def score_candidate(
        cls,
        track: Dict[str, Any],
        user_id: str,
        personas: List[Dict[str, Any]],
        library_vectors: Optional[np.ndarray] = None,
        session_state: Optional[Dict[str, Any]] = None,
        requested_mood: Optional[str] = None
    ) -> Tuple[float, Dict[str, float]]:
        """
        Computes pointwise score and breakdown of score components for a candidate track.
        """
        t_emb = track.get("embedding")
        if not t_emb or len(t_emb) != 768:
            return 0.50, {"base": 0.50}

        v = np.array(t_emb, dtype=np.float32)
        v_norm = np.linalg.norm(v)
        if v_norm == 0:
            return 0.50, {"base": 0.50}
        v /= v_norm

        components: Dict[str, float] = {}

        # 1. Persona Similarity (weighted by persona mass/context weight)
        persona_sim = 0.0
        if personas:
            max_sims = []
            weights = []
            for p in personas:
                p_vecs = [p["centroid"]] + [m["embedding"] for m in p.get("medoids", []) if m.get("embedding")]
                if p_vecs:
                    mat = np.array(p_vecs, dtype=np.float32)
                    c_sim = float(np.max(np.dot(mat, v)))
                    max_sims.append(c_sim)
                    weights.append(float(p.get("context_weight", p.get("mass", 1.0))))
            if max_sims:
                w_sum = sum(weights) or 1.0
                persona_sim = sum(s * w for s, w in zip(max_sims, weights)) / w_sum

        components["sim_persona"] = round(persona_sim, 4)

        # 2. Session Drift Affinity
        session_sim = 0.0
        if session_state and session_state.get("session_vector"):
            s_vec = np.array(session_state["session_vector"], dtype=np.float32)
            session_sim = float(np.dot(s_vec, v))
        components["sim_session"] = round(max(0.0, session_sim), 4)

        # 3. Popularity Percentile
        pop = float(track.get("popularity", 50) or 50)
        pop_pct = np.clip(pop / 100.0, 0.0, 1.0)
        components["pop_pct"] = round(pop_pct, 4)

        # 4. Novelty (1 - max cosine to user's listened set)
        novelty_score = 0.50
        if library_vectors is not None and len(library_vectors) > 0:
            lib_sims = np.dot(library_vectors, v)
            max_lib_sim = float(np.max(lib_sims))
            novelty_score = float(np.clip(1.0 - max_lib_sim, 0.0, 1.0))
        components["novelty"] = round(novelty_score, 4)

        # 5. Soft Mood Match
        mood_score = cls.compute_mood_affinity(track, requested_mood)
        components["mood_match"] = round(mood_score, 4)

        # 6. Source Prior (studio verified iTunes/Deezer)
        src = track.get("source", "itunes")
        src_prior = 1.0 if src in ("itunes", "deezer", "spotify") else 0.80
        components["source_prior"] = round(src_prior, 4)

        # 7. Dislike Penalty from Negative Memory
        dislike_pen = SessionTasteState.compute_dislike_penalty(user_id, t_emb)
        components["dislike_penalty"] = round(dislike_pen, 4)

        # 8. Preview Confidence Discount
        preview_conf = float(track.get("match_confidence", 1.0) or 1.0)
        components["preview_conf_discount"] = round(1.0 - preview_conf, 4)

        # Total Linear Score (Phase 1 formula per Playbook W8)
        total = (
            1.00 * components["sim_persona"] +
            0.80 * components["sim_session"] +
            0.30 * components["pop_pct"] +
            0.25 * components["novelty"] +
            0.20 * components["mood_match"] +
            0.10 * components["source_prior"] -
            0.80 * components["dislike_penalty"] -
            0.50 * components["preview_conf_discount"]
        )

        return float(round(total, 4)), components

    @classmethod
    def rank_candidates(
        cls,
        candidates: List[Dict[str, Any]],
        user_id: str,
        personas: List[Dict[str, Any]],
        library_vectors: Optional[np.ndarray] = None,
        session_state: Optional[Dict[str, Any]] = None,
        requested_mood: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Ranks all candidates through the pointwise scoring model and attaches score breakdowns.
        """
        scored_list = []
        for cand in candidates:
            total_score, comp_breakdown = cls.score_candidate(
                track=cand,
                user_id=user_id,
                personas=personas,
                library_vectors=library_vectors,
                session_state=session_state,
                requested_mood=requested_mood
            )
            item = dict(cand)
            item["score_pointwise"] = total_score
            item["score_components"] = comp_breakdown
            item["score_raw"] = cand.get("score", total_score)
            scored_list.append(item)

        # Sort descending by pointwise score
        scored_list.sort(key=lambda x: x["score_pointwise"], reverse=True)
        return scored_list
