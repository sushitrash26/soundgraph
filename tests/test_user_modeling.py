import pytest
import numpy as np
from backend.embeddings.persona_clusterer import PersonaClusterer
from backend.services.session_state import SessionTasteState

def test_interaction_weighting_formula():
    """Verify sub-linear play count saturation and feedback multiplier (W6.1)."""
    # 1 play, no feedback
    w1 = PersonaClusterer.compute_interaction_weight({"plays": 1, "reward": 0.0})
    # 50 plays, no feedback
    w50 = PersonaClusterer.compute_interaction_weight({"plays": 50, "reward": 0.0})
    # 50 plays, explicitly liked
    w50_liked = PersonaClusterer.compute_interaction_weight({"plays": 50, "reward": 1.0})
    # 50 plays, disliked
    w50_disliked = PersonaClusterer.compute_interaction_weight({"plays": 50, "reward": -1.0})

    assert w1 < w50
    assert abs(w50 - 1.0) < 1e-4
    assert abs(w50_liked - 1.5) < 1e-4
    assert abs(w50_disliked - 0.5) < 1e-4

def test_medoids_and_mass_calculation():
    """Verify that personas return top-3 medoids and normalized cluster mass."""
    np.random.seed(42)
    sample_tracks = []
    for i in range(12):
        vec = np.random.uniform(-1, 1, size=768).tolist()
        sample_tracks.append({
            "id": f"track_{i}",
            "name": f"Track {i}",
            "artists": [f"Artist {i % 4}"],
            "genres": ["indie", "rock"],
            "embedding": vec,
            "plays": 10 + i,
            "reward": 1.0 if i % 2 == 0 else 0.0
        })

    personas = PersonaClusterer.compute_taste_centroids(sample_tracks, max_k=2)
    assert len(personas) >= 1
    total_mass = sum(p["mass"] for p in personas)
    assert abs(total_mass - 1.0) < 1e-3

    for p in personas:
        assert "centroid" in p
        assert len(p["centroid"]) == 768
        assert "medoids" in p
        assert len(p["medoids"]) <= 3
        for m in p["medoids"]:
            assert "id" in m
            assert "name" in m
            assert "embedding" in m

def test_session_state_drift_and_negative_memory():
    """Verify session vector drift on like/dislike and dislike penalty."""
    user_id = "test_user_session_123"
    dummy_vec_1 = [0.1] * 768
    dummy_vec_2 = [-0.1] * 768

    # Record positive interaction
    SessionTasteState.record_positive(user_id, "track_pos_1", dummy_vec_1, "Artist Pos")
    state = SessionTasteState.get_state(user_id)
    assert state["positive_count"] >= 1
    assert state["session_vector"] is not None

    # Record negative interaction
    SessionTasteState.record_negative(user_id, "track_neg_1", dummy_vec_2, "Artist Neg")
    state_after = SessionTasteState.get_state(user_id)
    assert len(state_after["negative_memory"]) >= 1

    # Dislike penalty: test track identical to disliked vector should have high penalty
    pen_high = SessionTasteState.compute_dislike_penalty(user_id, dummy_vec_2)
    # Test track opposite should have 0 penalty
    pen_low = SessionTasteState.compute_dislike_penalty(user_id, dummy_vec_1)

    assert pen_high > 0.80
    assert pen_low == 0.0
