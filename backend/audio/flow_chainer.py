import numpy as np
from typing import List, Dict, Any, Tuple

class AIFlowChainer:
    """
    AI-Driven Session Flow & Vector Continuity Engine:
    Zero hardcoded key/BPM dictionaries.
    Uses continuous 768-D Gemini vector embeddings to compute acoustic transition smoothness
    and chains recommended tracks into a seamless, harmonic listening flow.
    """

    @staticmethod
    def _cosine_similarity(a: List[float], b: List[float]) -> float:
        vec_a = np.array(a)
        vec_b = np.array(b)
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        if norm_a == 0 or norm_b == 0:
            return 0.5
        return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))

    @classmethod
    def chain_session_flow(cls, tracks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Orders candidate tracks into a seamless, continuous listening progression
        using Hamiltonian nearest-neighbor vector chaining in 768-D latent space.
        """
        if not tracks or len(tracks) <= 2:
            return tracks

        # Separate tracks with embeddings from those without
        valid_tracks = [t for t in tracks if t.get("embedding") and len(t["embedding"]) == 768]
        other_tracks = [t for t in tracks if not t.get("embedding") or len(t["embedding"]) != 768]

        if not valid_tracks:
            return tracks

        # Start with the highest-scoring candidate as anchor
        chain = [valid_tracks[0]]
        remaining = valid_tracks[1:]

        while remaining:
            current_track = chain[-1]
            best_idx = 0
            best_sim = -1.0

            for i, cand in enumerate(remaining):
                sim = cls._cosine_similarity(current_track["embedding"], cand["embedding"])
                if sim > best_sim:
                    best_sim = sim
                    best_idx = i

            next_track = remaining.pop(best_idx)
            # Add subtle flow transition tag
            flow_pct = int(round(best_sim * 100))
            next_track["transition_flow"] = f"{flow_pct}% harmonic continuity"
            chain.append(next_track)

        return chain + other_tracks
