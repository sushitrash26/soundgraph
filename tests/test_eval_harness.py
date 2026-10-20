import pytest
import numpy as np
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

def test_recall_and_hit_rate():
    ranked = ["t1", "t2", "t3", "t4", "t5"]
    relevant = {"t2", "t4"}
    
    # K = 3 -> only t2 is in top 3
    assert recall_at_k(ranked, relevant, k=3) == 0.5
    assert hit_rate_at_k(ranked, relevant, k=3) == 1.0
    
    # K = 1 -> no relevant item in top 1
    assert recall_at_k(ranked, relevant, k=1) == 0.0
    assert hit_rate_at_k(ranked, relevant, k=1) == 0.0
    
    # K = 5 -> all relevant items retrieved
    assert recall_at_k(ranked, relevant, k=5) == 1.0
    assert hit_rate_at_k(ranked, relevant, k=5) == 1.0

def test_ndcg_at_k():
    relevant = {"t1", "t2"}
    
    # Ideal order: t1, t2 at pos 0 and 1
    perfect_rank = ["t1", "t2", "t3"]
    assert pytest.approx(ndcg_at_k(perfect_rank, relevant, k=3), 1e-4) == 1.0
    
    # Suboptimal order: t3, t1, t2
    suboptimal = ["t3", "t1", "t2"]
    ndcg_sub = ndcg_at_k(suboptimal, relevant, k=3)
    assert 0.0 < ndcg_sub < 1.0
    
    # Empty relevant
    assert ndcg_at_k(perfect_rank, set(), k=3) == 0.0

def test_mrr():
    relevant = {"target"}
    assert mrr(["target", "other1", "other2"], relevant) == 1.0
    assert mrr(["other1", "target", "other2"], relevant) == 0.5
    assert mrr(["other1", "other2", "target"], relevant) == pytest.approx(1.0 / 3.0)
    assert mrr(["other1", "other2"], relevant) == 0.0

def test_intra_list_distance():
    # Identical vectors: distance must be 0
    v1 = np.array([1.0, 0.0, 0.0])
    v2 = np.array([1.0, 0.0, 0.0])
    assert intra_list_distance([v1, v2], k=2) == pytest.approx(0.0)
    
    # Orthogonal vectors: distance must be 1.0
    v_ortho = np.array([0.0, 1.0, 0.0])
    assert intra_list_distance([v1, v_ortho], k=2) == pytest.approx(1.0)

def test_compute_auc():
    # Perfectly separated: liked scores > disliked scores
    pos = [0.9, 0.8, 0.7]
    neg = [0.3, 0.2, 0.1]
    assert compute_auc(pos, neg) == 1.0
    
    # Completely reversed
    assert compute_auc(neg, pos) == 0.0
    
    # Tied
    assert compute_auc([0.5], [0.5]) == 0.5

def test_bootstrap_ci():
    values = [0.2, 0.22, 0.25, 0.28, 0.30, 0.32, 0.35]
    ci = bootstrap_ci(values, n_bootstrap=500, ci=0.95, seed=42)
    assert ci["ci_lower"] <= ci["mean"] <= ci["ci_upper"]

def test_temporal_split():
    history = [
        {"id": f"t_{i}", "last_played": f"2026-10-1{i}T10:00:00Z"}
        for i in range(10)
    ]
    train, test = temporal_split(history, test_frac=0.20, min_test=2)
    assert len(train) + len(test) == 10
    assert len(test) >= 2
    # Ensure chronological split
    assert train[-1]["id"] < test[0]["id"]

def test_baseline_models_sanity():
    # Toy dataset of 5 candidates and 3 train tracks
    rng = np.random.default_rng(42)
    dim = 16
    candidates = [
        {"id": f"c_{i}", "name": f"Cand {i}", "popularity": 50 + i * 5, "embedding": rng.standard_normal(dim).tolist()}
        for i in range(5)
    ]
    train = [
        {"id": f"tr_{i}", "name": f"Train {i}", "plays": 3, "reward": 1.0, "embedding": rng.standard_normal(dim).tolist()}
        for i in range(3)
    ]
    
    models = [
        RandomBaseline(seed=42),
        PopularityBaseline(),
        SingleMeanCentroidBaseline(),
        CurrentMultiPersonaBaseline(seed=42),
        WeightedNormalizedPersonaBaseline(seed=42)
    ]
    
    for m in models:
        ranked = m.rank(user_train=train, candidates=candidates, top_k=3)
        assert len(ranked) == 3
        assert len({r["id"] for r in ranked}) == 3  # No duplicates
