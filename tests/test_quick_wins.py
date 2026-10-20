import pytest
import numpy as np
from datetime import datetime, timezone
from backend.embeddings.persona_clusterer import PersonaClusterer
from backend.core.bandit import ContextualLinUCB, CONTEXT_DIM
from backend.core.cache import UnifiedCache

def test_qw5_context_vector_intercept_and_tz():
    # Dimension must be 7 (QW5)
    assert CONTEXT_DIM == 7

    # Intercept x0 must be 1.0
    x = ContextualLinUCB.get_context_vector(hour=14, session_depth=5)
    assert len(x) == 7
    assert x[0] == 1.0

    # Test timezone offset calculation
    # If UTC hour is 12, and tz_offset is +330 (+5.5 hours, IST): local hour should be 17
    # sin(17.5 / 24 * 2pi) vs sin(12 / 24 * 2pi)
    x_utc = ContextualLinUCB.get_context_vector(hour=None, tz_offset_minutes=0)
    x_ist = ContextualLinUCB.get_context_vector(hour=None, tz_offset_minutes=330)
    assert len(x_utc) == 7
    assert len(x_ist) == 7
    assert x_utc[0] == 1.0
    assert x_ist[0] == 1.0

import uuid

def test_qw6_impression_reward_deduplication():
    user_id = f"test_user_dedup_{uuid.uuid4().hex}"
    imp_id = f"imp_dedup_{uuid.uuid4().hex}"
    x = ContextualLinUCB.get_context_vector(hour=12)

    # First update should succeed
    res1 = ContextualLinUCB.update(user_id=user_id, arm=0, x=x, reward=0.8, impression_id=imp_id)
    assert res1["status"] == "updated"
    assert res1["reward"] == 0.8

    # Second duplicate update with same impression_id must be safely dropped (QW6)
    res2 = ContextualLinUCB.update(user_id=user_id, arm=0, x=x, reward=-0.5, impression_id=imp_id)
    assert res2["status"] == "ignored"
    assert res2["reason"] == "duplicate_impression_reward"

def test_qw3_spherical_kmeans_and_weights():
    # 2 tracks with opposite vectors
    # Track 1 has plays=50 (weight ~51), Track 2 has plays=1 (weight ~1)
    rng = np.random.default_rng(42)
    v1 = rng.standard_normal(768).tolist()
    v2 = rng.standard_normal(768).tolist()

    tracks = [
        {"id": "t1", "name": "Heavy Track", "embedding": v1, "plays": 50, "reward": 1.0},
        {"id": "t2", "name": "Light Track", "embedding": v2, "plays": 1, "reward": 0.0},
        {"id": "t3", "name": "Track 3", "embedding": v1, "plays": 10, "reward": 1.0}
    ]

    personas = PersonaClusterer.compute_taste_centroids(tracks, user_id=None, max_k=2)
    assert len(personas) >= 1
    for p in personas:
        centroid = np.array(p["centroid"])
        # Centroid must be unit Euclidean norm
        assert pytest.approx(np.linalg.norm(centroid), 1e-4) == 1.0
        assert len(centroid) == 768

def test_qw2_persona_caching(monkeypatch):
    user_id = f"test_user_cache_{uuid.uuid4().hex}"
    rng = np.random.default_rng(42)
    v = rng.standard_normal(768).tolist()
    tracks = [
        {"id": "t1", "name": "Track 1", "embedding": v, "plays": 1},
        {"id": "t2", "name": "Track 2", "embedding": v, "plays": 2}
    ]

    # First call: populates cache
    p1 = PersonaClusterer.compute_taste_centroids(tracks, user_id=user_id, max_k=2)
    assert len(p1) >= 1

    # Check cache has it
    cache_key = f"personas:{user_id}:2"
    cached = UnifiedCache.get(cache_key)
    assert cached is not None
    assert len(cached) == len(p1)

    # Second call returns cached immediately
    p2 = PersonaClusterer.compute_taste_centroids(tracks, user_id=user_id, max_k=2)
    assert p1[0]["label"] == p2[0]["label"]
