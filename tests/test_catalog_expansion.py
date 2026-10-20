import pytest
import os
import tempfile
from backend.services.catalog_expansion import CatalogExpander, BLOCKLIST_REGEX

def test_blocklist_regex():
    assert BLOCKLIST_REGEX.search("Daft Punk - One More Time (Slowed + Reverb)") is not None
    assert BLOCKLIST_REGEX.search("The Weeknd - Blinding Lights (Karaoke Version)") is not None
    assert BLOCKLIST_REGEX.search("Drake Type Beat - Free Instrumental") is not None
    assert BLOCKLIST_REGEX.search("Tame Impala - Let It Happen (8D Audio)") is not None
    assert BLOCKLIST_REGEX.search("Coldplay - Yellow (Sped Up)") is not None
    assert BLOCKLIST_REGEX.search("Nightcore - Starboy") is not None
    
    # Valid studio titles must NOT match
    assert BLOCKLIST_REGEX.search("Blinding Lights") is None
    assert BLOCKLIST_REGEX.search("Let It Happen") is None
    assert BLOCKLIST_REGEX.search("Get Lucky (feat. Pharrell Williams)") is None

def test_quality_gates():
    expander = CatalogExpander()

    # 1. Missing title / artist
    ok, reason = expander.passes_quality_gates({"trackName": "", "artistName": "Artist"})
    assert not ok
    assert "missing" in reason

    # 2. Blocklisted title
    ok, reason = expander.passes_quality_gates({
        "trackName": "Song (Karaoke)",
        "artistName": "Artist",
        "trackTimeMillis": 180000,
        "artworkUrl100": "https://img.com/100.jpg",
        "previewUrl": "https://audio-ssl.itunes.apple.com/test.m4a"
    })
    assert not ok
    assert "blocklist" in reason

    # 3. Invalid duration (<60s)
    ok, reason = expander.passes_quality_gates({
        "trackName": "Short Clip Track",
        "artistName": "Artist",
        "trackTimeMillis": 30000,
        "artworkUrl100": "https://img.com/100.jpg",
        "previewUrl": "https://audio-ssl.itunes.apple.com/test.m4a"
    })
    assert not ok
    assert "duration" in reason

    # 4. Missing preview
    ok, reason = expander.passes_quality_gates({
        "trackName": "Real Song",
        "artistName": "Artist",
        "trackTimeMillis": 210000,
        "artworkUrl100": "https://img.com/100.jpg",
        "previewUrl": None
    })
    assert not ok
    assert "preview" in reason

def test_checkpoint_io():
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    try:
        expander = CatalogExpander(checkpoint_path=path)
        cp = expander.load_checkpoint()
        assert cp["processed_artists"] == []
        assert cp["ingested_tracks_count"] == 0

        cp["processed_artists"].append("Artist A")
        cp["ingested_tracks_count"] = 42
        expander.save_checkpoint(cp)

        loaded = expander.load_checkpoint()
        assert loaded["processed_artists"] == ["Artist A"]
        assert loaded["ingested_tracks_count"] == 42
    finally:
        if os.path.exists(path):
            os.remove(path)
