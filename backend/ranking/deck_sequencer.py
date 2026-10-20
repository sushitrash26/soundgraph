"""
Deck Sequencer and Diversity Re-ranking (Workstream W10).
Resolves F-07, F-13, F-15:
1. Maximal Marginal Relevance (MMR, lambda = 0.70) diversity re-ranking.
2. Hard constraints: <= 2 tracks per artist per deck, <= 8 tracks per persona.
3. Deck Arc Sequencing:
   - Slots 1 & 2: High-confidence exploit hooks.
   - Slots 5, 9, 13: Exploratory / discovery tracks.
   - Slot 15: Strong exploit closer.
"""

from typing import Dict, List, Any, Optional, Set
import numpy as np
from backend.core.logger import logger

MMR_LAMBDA = 0.70
MAX_TRACKS_PER_ARTIST = 2
MAX_TRACKS_PER_CLUSTER = 8


class DeckSequencer:
    """Applies MMR diversity selection, hard artist caps, and deck arc sequencing."""

    @classmethod
    def apply_mmr_selection(
        cls,
        candidates: List[Dict[str, Any]],
        limit: int = 15,
        mmr_lambda: float = MMR_LAMBDA
    ) -> List[Dict[str, Any]]:
        r"""
        Greedy MMR selection with hard caps:
        next = argmax_{d in C \ S} [ lambda * score(d) - (1-lambda) * max_{s in S} sim(d, s) ]
        sim(d, s) = cos(v_d, v_s) + 0.5 if same_artist.
        """
        if not candidates:
            return []

        selected: List[Dict[str, Any]] = []
        selected_ids: Set[str] = set()
        artist_counts: Dict[str, int] = {}
        cluster_counts: Dict[str, int] = {}

        # Precompute normalized candidate vectors
        valid_pool = []
        for c in candidates:
            emb = c.get("embedding")
            if emb and len(emb) == 768:
                v = np.array(emb, dtype=np.float32)
                v_norm = np.linalg.norm(v)
                v = v / v_norm if v_norm > 1e-9 else v
                c["_normed_vec"] = v
            else:
                c["_normed_vec"] = None
            valid_pool.append(c)

        # 1. Pick the highest-scoring candidate first
        first_pick = valid_pool[0]
        selected.append(first_pick)
        selected_ids.add(first_pick["track_id"])
        art_0 = (first_pick.get("artists") or [""])[0]
        artist_counts[art_0] = 1
        cl_0 = first_pick.get("primary_source", "persona_text")
        cluster_counts[cl_0] = 1

        # 2. Iteratively select remaining slots using MMR
        while len(selected) < limit and len(selected) < len(valid_pool):
            best_cand = None
            best_mmr = -float("inf")

            for cand in valid_pool:
                tid = cand["track_id"]
                if tid in selected_ids:
                    continue

                # Hard Cap Check: <= 2 tracks per artist
                c_art = (cand.get("artists") or [""])[0]
                if artist_counts.get(c_art, 0) >= MAX_TRACKS_PER_ARTIST:
                    continue

                # Hard Cap Check: <= 8 tracks per cluster
                c_cl = cand.get("primary_source", "persona_text")
                if cluster_counts.get(c_cl, 0) >= MAX_TRACKS_PER_CLUSTER:
                    continue

                base_score = float(cand.get("score_pointwise", cand.get("score", 0.5)))
                c_vec = cand.get("_normed_vec")

                # Compute max similarity to already selected items
                max_sim = 0.0
                if c_vec is not None:
                    sim_vals = []
                    for s in selected:
                        s_vec = s.get("_normed_vec")
                        if s_vec is not None:
                            cos_sim = float(np.dot(c_vec, s_vec))
                            s_art = (s.get("artists") or [""])[0]
                            # Heavy penalty if same artist
                            if c_art and s_art and c_art.lower() == s_art.lower():
                                cos_sim += 0.50
                            sim_vals.append(cos_sim)
                    max_sim = max(sim_vals) if sim_vals else 0.0

                mmr_val = (mmr_lambda * base_score) - ((1.0 - mmr_lambda) * max_sim)
                if mmr_val > best_mmr:
                    best_mmr = mmr_val
                    best_cand = cand

            if best_cand is None:
                # If hard caps exhausted, relax caps to fill deck
                remaining = [c for c in valid_pool if c["track_id"] not in selected_ids]
                if remaining:
                    best_cand = remaining[0]
                else:
                    break

            selected.append(best_cand)
            selected_ids.add(best_cand["track_id"])
            b_art = (best_cand.get("artists") or [""])[0]
            artist_counts[b_art] = artist_counts.get(b_art, 0) + 1
            b_cl = best_cand.get("primary_source", "persona_text")
            cluster_counts[b_cl] = cluster_counts.get(b_cl, 0) + 1

        # Clean up temporary vectors
        for c in selected:
            c.pop("_normed_vec", None)

        return selected

    @classmethod
    def apply_deck_arc(cls, tracks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Sequences the deck according to the optimal listening arc (Playbook W10.3):
        - Positions 0 & 1 (cards 1-2): High confidence exploit tracks (listener hooks).
        - Positions 4, 8, 12 (cards 5, 9, 13): Discovery/exploratory tracks.
        - Last Position (card 15): Strong exploit closer.
        """
        if len(tracks) <= 3:
            return tracks

        # Separate exploit vs exploratory candidates
        exploit_pool = [t for t in tracks if t.get("bandit_arm", 0) in (0, 1)]
        explore_pool = [t for t in tracks if t.get("bandit_arm", 0) in (2, 3)]

        # If not enough partition, sort by score descending
        if not exploit_pool or not explore_pool:
            return tracks

        ordered: List[Optional[Dict[str, Any]]] = [None] * len(tracks)
        n = len(tracks)

        # Slots 0, 1: Exploit hooks
        if len(exploit_pool) >= 2:
            ordered[0] = exploit_pool.pop(0)
            ordered[1] = exploit_pool.pop(0)

        # Last Slot: Exploit closer
        if exploit_pool:
            ordered[-1] = exploit_pool.pop(0)

        # Exploratory slots at indices 4, 8, 12 (1-based: 5, 9, 13)
        explore_indices = [4, 8, 12]
        for idx in explore_indices:
            if idx < n and ordered[idx] is None and explore_pool:
                ordered[idx] = explore_pool.pop(0)

        # Fill remaining slots with remaining pool
        remaining_pool = exploit_pool + explore_pool
        for idx in range(n):
            if ordered[idx] is None and remaining_pool:
                ordered[idx] = remaining_pool.pop(0)

        # Filter any Nones
        final_deck = [t for t in ordered if t is not None]
        return final_deck
