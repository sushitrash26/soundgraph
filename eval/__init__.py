"""
SoundGraph Evaluation Harness (Workstream W2)
Provides offline metrics, train/test splitting, baseline models, and regression reports.
"""

from eval.metrics import (
    recall_at_k,
    hit_rate_at_k,
    ndcg_at_k,
    mrr,
    coverage_at_k,
    novelty_at_k,
    intra_list_distance,
    artist_repeat_rate,
    compute_auc,
    bootstrap_ci
)
from eval.split import temporal_split
from eval.baselines import (
    RandomBaseline,
    PopularityBaseline,
    SingleMeanCentroidBaseline,
    CurrentMultiPersonaBaseline,
    WeightedNormalizedPersonaBaseline
)

__all__ = [
    "recall_at_k",
    "hit_rate_at_k",
    "ndcg_at_k",
    "mrr",
    "coverage_at_k",
    "novelty_at_k",
    "intra_list_distance",
    "artist_repeat_rate",
    "compute_auc",
    "bootstrap_ci",
    "temporal_split",
    "RandomBaseline",
    "PopularityBaseline",
    "SingleMeanCentroidBaseline",
    "CurrentMultiPersonaBaseline",
    "WeightedNormalizedPersonaBaseline"
]
