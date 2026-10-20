"""
Reciprocal Rank Fusion (RRF) Candidate Combiner (Workstream W7).
Resolves F-05, F-07, F-22:
Combines multiple honest candidate sources (persona_text, similar_to, catalog)
without scale mismatches (eliminates mixing raw cosines, graph edge scores, and popularity).

RRF Formula:
RRF(d) = sum_s [ w_s / (60 + rank_s(d)) ]
"""

from typing import Dict, List, Any, Optional
from backend.core.logger import logger

# Default source weights per Playbook W7
DEFAULT_RRF_WEIGHTS = {
    "persona_text": 1.0,
    "similar_to": 0.6,
    "session_seed": 1.2,
    "catalog": 0.3,
    "genre_popular": 0.3
}

DEFAULT_K_RRF = 60


class ReciprocalRankFuser:
    """Combines heterogeneous candidate rankings via weighted Reciprocal Rank Fusion."""

    @classmethod
    def fuse_candidates(
        cls,
        source_candidates: Dict[str, List[Dict[str, Any]]],
        weights: Optional[Dict[str, float]] = None,
        k_rrf: int = DEFAULT_K_RRF,
        top_k: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Fuses ranked candidate lists from multiple sources into a single unified ranking.
        Each candidate d receives:
            score(d) = sum_s [ w_s / (k_rrf + rank_s(d)) ]
        where rank_s(d) is 1-indexed rank within source s.
        """
        w_map = weights or DEFAULT_RRF_WEIGHTS
        scores: Dict[str, float] = {}
        candidate_meta: Dict[str, Dict[str, Any]] = {}
        source_ranks: Dict[str, Dict[str, int]] = {}
        source_contributions: Dict[str, Dict[str, float]] = {}

        for source_name, c_list in source_candidates.items():
            if not c_list:
                continue
            weight = w_map.get(source_name, 0.5)

            for rank_0, cand in enumerate(c_list):
                tid = cand.get("track_id") or cand.get("id")
                if not tid:
                    continue

                rank_1 = rank_0 + 1
                rrf_contrib = weight / (k_rrf + rank_1)

                scores[tid] = scores.get(tid, 0.0) + rrf_contrib

                if tid not in candidate_meta:
                    candidate_meta[tid] = dict(cand)
                    candidate_meta[tid]["track_id"] = tid
                    source_ranks[tid] = {}
                    source_contributions[tid] = {}

                source_ranks[tid][source_name] = rank_1
                source_contributions[tid][source_name] = rrf_contrib

        # Sort candidates descending by RRF score
        sorted_track_ids = sorted(scores.keys(), key=lambda t: scores[t], reverse=True)
        if top_k is not None:
            sorted_track_ids = sorted_track_ids[:top_k]

        fused_results: List[Dict[str, Any]] = []
        for tid in sorted_track_ids:
            item = candidate_meta[tid]
            total_score = scores[tid]

            # Determine dominant contributing source
            contribs = source_contributions.get(tid, {})
            primary_src = max(contribs.keys(), key=lambda s: contribs[s]) if contribs else "unknown"

            item["score_fused"] = round(total_score, 5)
            item["score"] = round(total_score * 100.0, 3)  # Scaled for UI display
            item["primary_source"] = primary_src
            item["source_ranks"] = source_ranks.get(tid, {})
            item["rrf_sources"] = list(source_ranks.get(tid, {}).keys())

            # Map primary source to bandit arm ID
            if primary_src == "persona_text":
                item["bandit_arm"] = 0
                item["arm_name"] = "persona_exploit"
            elif primary_src in ("similar_to", "session_seed"):
                item["bandit_arm"] = 1
                item["arm_name"] = "graph_similarity"
            elif primary_src in ("catalog", "genre_popular"):
                item["bandit_arm"] = 2
                item["arm_name"] = "catalog_diversity"
            else:
                item["bandit_arm"] = 3
                item["arm_name"] = "frontier_wildcard"

            fused_results.append(item)

        return fused_results
