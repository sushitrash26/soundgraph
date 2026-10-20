import pytest
from backend.services.preview_service import PreviewResolver, PreviewVerifier
from backend.graph.queries import GraphQueries

def test_token_set_similarity():
    s1 = "Starboy (Official Music Video) [HD] feat. Daft Punk"
    s2 = "Starboy"
    sim = PreviewResolver.token_set_similarity(s1, s2)
    assert sim >= 0.99

def test_version_penalties():
    source_title = "Hotel California"
    # Candidate is an acoustic karaoke version
    candidate = {
        "trackName": "Hotel California (Acoustic Karaoke Version)",
        "artistName": "Eagles",
        "trackTimeMillis": 390000
    }
    score = PreviewResolver.calculate_match_score(
        source_title=source_title,
        source_artists=["Eagles"],
        source_duration_ms=390000,
        source_album=None,
        candidate=candidate
    )
    # Penalties for 'acoustic', 'karaoke', 'version' should depress score below 0.80
    assert score < 0.60

def test_preview_verifier_rejects_youtube():
    yt_urls = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://music.youtube.com/watch?v=12345"
    ]
    for url in yt_urls:
        assert PreviewVerifier.is_allowed_host(url) is False
        is_ok, reason, _ = PreviewVerifier.verify_url(url)
        assert is_ok is False
        assert "disallowed_host" in reason

def test_preview_verifier_accepts_itunes_host():
    itunes_url = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a"
    assert PreviewVerifier.is_allowed_host(itunes_url) is True

def test_recommendations_zero_silent_cards():
    recs = GraphQueries.get_recommendations(user_id="astitva_demo_user", limit=15)
    assert len(recs) > 0
    for r in recs:
        purl = r.get("preview_url")
        assert purl, f"Track {r.get('track_name')} has null preview_url"
        assert "audio-ssl.itunes.apple.com" in purl or "dzcdn.net" in purl or "p.scdn.co" in purl
        assert "youtube.com" not in purl and "youtu.be" not in purl

def test_qw1_learning_guard_silent_cards():
    # Attempt feedback on a fake or failed track ID
    fake_track_id = "test:unplayable_track:999"
    res = GraphQueries.record_feedback(user_id="astitva_demo_user", track_id=fake_track_id, reward=1.0)
    assert res.get("status") == "ignored"
    assert res.get("reason") == "silent_card_feedback_dropped"

    dwell_res = GraphQueries.record_dwell_telemetry(
        user_id="astitva_demo_user",
        track_id=fake_track_id,
        arm=0,
        dwell_ms=12000
    )
    assert dwell_res.get("status") == "ignored"
    assert dwell_res.get("reason") == "silent_card_telemetry_dropped"
