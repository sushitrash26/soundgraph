import pytest
import numpy as np
from backend.ranking.pointwise_ranker import PointwiseRanker
from backend.ranking.deck_sequencer import DeckSequencer
from backend.graph.queries import GraphQueries

def test_pointwise_ranker_scoring_and_components():
    """Verify that pointwise ranker produces transparent score breakdown and handles soft mood."""
    dummy_vec = [0.05] * 768
    candidate = {
        "track_id": "test_t1",
        "name": "Test Track 1",
        "artists": ["Test Artist"],
        "embedding": dummy_vec,
        "popularity": 80,
        "valence": 0.82,
        "energy": 0.78,
        "feature_confidence": 0.90,
        "source": "itunes",
        "match_confidence": 1.0
    }

    dummy_persona = {
        "id": "p1",
        "centroid": dummy_vec,
        "medoids": [{"embedding": dummy_vec}],
        "mass": 1.0,
        "context_weight": 1.0
    }

    score, components = PointwiseRanker.score_candidate(
        track=candidate,
        user_id="test_user",
        personas=[dummy_persona],
        requested_mood="euphoric"
    )

    assert isinstance(score, float)
    assert "sim_persona" in components
    assert "mood_match" in components
    assert components["mood_match"] > 0.50  # Matches euphoric target (0.80, 0.75)
    assert components["sim_persona"] > 0.90
    assert "dislike_penalty" in components

def test_deck_sequencer_mmr_and_artist_cap():
    """Verify that MMR selection enforces <= 2 tracks per artist."""
    candidates = []
    # 5 tracks by the same artist with high scores
    for i in range(5):
        candidates.append({
            "track_id": f"art1_t{i}",
            "name": f"Song {i}",
            "artists": ["Monopolist Artist"],
            "score_pointwise": 0.95 - (i * 0.01),
            "primary_source": "persona_text",
            "embedding": [0.05 + (i * 0.001)] * 768
        })
    # 5 tracks by other artists
    for i in range(5):
        candidates.append({
            "track_id": f"art2_t{i}",
            "name": f"Other Song {i}",
            "artists": [f"Diverse Artist {i}"],
            "score_pointwise": 0.80 - (i * 0.01),
            "primary_source": "persona_text",
            "embedding": [-0.05 - (i * 0.001)] * 768
        })

    deck = DeckSequencer.apply_mmr_selection(candidates, limit=6, mmr_lambda=0.70)
    assert len(deck) == 6
    # Count tracks by Monopolist Artist
    mono_count = sum(1 for d in deck if d["artists"][0] == "Monopolist Artist")
    assert mono_count <= 2, f"Expected <= 2 tracks for Monopolist Artist, got {mono_count}"

def test_deck_arc_sequencing():
    """Verify that deck arc spaces exploit hooks and explore cards."""
    deck = []
    for i in range(15):
        arm = 0 if i < 10 else 2
        deck.append({
            "track_id": f"t_{i}",
            "name": f"Track {i}",
            "bandit_arm": arm,
            "artists": [f"Artist {i}"]
        })

    arced = DeckSequencer.apply_deck_arc(deck)
    assert len(arced) == 15
    # First 2 should be exploit
    assert arced[0]["bandit_arm"] in (0, 1)
    assert arced[1]["bandit_arm"] in (0, 1)
    # Last should be exploit
    assert arced[-1]["bandit_arm"] in (0, 1)

def test_live_recommendation_with_phase_c():
    """End-to-end integration test of get_recommendations with Phase C pipeline."""
    recs = GraphQueries.get_recommendations(user_id="user_2", limit=6, mood="chill")
    assert isinstance(recs, list)
    if recs:
        assert len(recs) <= 6
        for r in recs:
            assert "track_id" in r
            assert "score" in r
            assert "score_fused" in r
            assert "preview_url" in r
            # Check artist repeat constraint in served deck
            art_list = [t["artists"][0] for t in recs if t.get("artists")]
            for a in set(art_list):
                assert art_list.count(a) <= 2
