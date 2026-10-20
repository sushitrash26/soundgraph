import pytest
import numpy as np
from backend.services.feature_calibrator import FeatureCalibrator, ENSEMBLE_ANCHORS
from backend.embeddings.gemini_embedder import GeminiEmbedder

def test_ensemble_anchors_definition():
    """Verify that all 4 acoustic axes have at least 5 anchor pairs."""
    axes = ["energy", "valence", "danceability", "acousticness"]
    for axis in axes:
        assert axis in ENSEMBLE_ANCHORS
        assert len(ENSEMBLE_ANCHORS[axis]) >= 5, f"{axis} has less than 5 anchor pairs"
        for pos_text, neg_text in ENSEMBLE_ANCHORS[axis]:
            assert len(pos_text) > 10
            assert len(neg_text) > 10

def test_raw_scores_computation():
    """Verify raw score computation with dummy vector."""
    dummy_vec = [0.05] * 768
    raws = FeatureCalibrator.compute_raw_scores(dummy_vec)
    for feat in ["energy", "valence", "danceability", "acousticness"]:
        raw_key = f"{feat}_raw"
        assert raw_key in raws
        assert isinstance(raws[raw_key], float)
        assert -1.0 <= raws[raw_key] <= 1.0

def test_ground_truth_validation_reporting():
    """Test validation report generation and bootstrap CIs."""
    # Create synthetic dataset with known positive correlation
    np.random.seed(42)
    n = 20
    true_energy = np.random.uniform(0.1, 0.9, size=n)
    proxy_energy = true_energy + np.random.normal(0, 0.1, size=n)

    sample_tracks = []
    for i in range(n):
        sample_tracks.append({
            "id": f"t_{i}",
            "tempo": 120.0,  # Mark as ground truth
            "embedding": [0.01] * 768,
            "energy": float(true_energy[i]),
            "energy_raw": float(proxy_energy[i]),
            "valence": 0.5,
            "valence_raw": 0.5,
            "danceability": 0.5,
            "danceability_raw": 0.5,
            "acousticness": 0.5,
            "acousticness_raw": 0.5
        })

    report = FeatureCalibrator.validate_ground_truth(sample_tracks)
    assert report["n_ground_truth"] == n
    assert "energy" in report["features"]
    assert report["features"]["energy"]["spearman_rho"] > 0.70
    assert len(report["features"]["energy"]["ci_95"]) == 2

def test_non_circularity_embedding_text_v2():
    """Verify that build_track_semantic_description does not contain circular numeric feature strings."""
    track_metadata = {
        "id": "test:track:1",
        "name": "Midnight City",
        "artists": ["M83"],
        "album": "Hurry Up, We're Dreaming",
        "genres": ["synthpop", "electronic"],
        "features": {
            "energy": 0.88,
            "valence": 0.55,
            "danceability": 0.62,
            "acousticness": 0.05
        }
    }
    desc = GeminiEmbedder.build_track_semantic_description(track_metadata)
    assert "Midnight City" in desc
    assert "M83" in desc
    assert "Hurry Up, We're Dreaming" in desc
    assert "synthpop" in desc
    # Ensure no circular numeric floats appear in descriptor
    assert "0.88" not in desc
    assert "0.55" not in desc
    assert "energy intensity:" not in desc
    assert "mood valence:" not in desc
