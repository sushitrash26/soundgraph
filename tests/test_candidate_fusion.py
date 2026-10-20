import pytest
from backend.graph.candidate_fusion import ReciprocalRankFuser
from backend.graph.queries import GraphQueries

def test_rrf_fusion_ordering_and_overlap():
    """Verify that reciprocal rank fusion boosts overlapping items and respects rankings."""
    source_candidates = {
        "persona_text": [
            {"track_id": "t1", "name": "Track 1"},
            {"track_id": "t2", "name": "Track 2"},
            {"track_id": "t3", "name": "Track 3"},
        ],
        "similar_to": [
            {"track_id": "t2", "name": "Track 2"},
            {"track_id": "t4", "name": "Track 4"},
        ],
        "catalog": [
            {"track_id": "t5", "name": "Track 5"},
        ]
    }

    fused = ReciprocalRankFuser.fuse_candidates(
        source_candidates=source_candidates,
        weights={"persona_text": 1.0, "similar_to": 0.6, "catalog": 0.3},
        k_rrf=60
    )

    # t2 appears in both persona_text (rank 2) and similar_to (rank 1)
    # score(t2) = 1.0 / (60 + 2) + 0.6 / (60 + 1) = 1/62 + 0.6/61 = 0.016129 + 0.009836 = 0.025965
    # score(t1) = 1.0 / (60 + 1) = 1/61 = 0.016393
    # Therefore t2 MUST outrank t1!
    assert len(fused) == 5
    assert fused[0]["track_id"] == "t2"
    assert fused[1]["track_id"] == "t1"
    assert "score_fused" in fused[0]
    assert fused[0]["score_fused"] > fused[1]["score_fused"]
    assert "persona_text" in fused[0]["rrf_sources"]
    assert "similar_to" in fused[0]["rrf_sources"]

def test_rrf_empty_sources():
    """Verify graceful handling when sources are empty or missing."""
    empty_candidates = {
        "persona_text": [],
        "similar_to": [],
        "catalog": [{"track_id": "t_fallback", "name": "Fallback Track"}]
    }
    fused = ReciprocalRankFuser.fuse_candidates(empty_candidates)
    assert len(fused) == 1
    assert fused[0]["track_id"] == "t_fallback"
    assert fused[0]["primary_source"] == "catalog"
    assert fused[0]["bandit_arm"] == 2

def test_live_recommendation_serving_rrf():
    """Verify that get_recommendations runs with RRF and returns playable tracks."""
    recs = GraphQueries.get_recommendations(user_id="user_2", limit=5)
    assert isinstance(recs, list)
    if recs:
        assert len(recs) <= 5
        for r in recs:
            assert "track_id" in r
            assert "track_name" in r
            assert "score" in r
            assert "preview_url" in r
            assert r.get("request_id") is not None
            assert r.get("impression_id") is not None
