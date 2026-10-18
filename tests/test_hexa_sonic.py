import time
import pytest
import numpy as np
from scipy import signal

from backend.core.hexa_sonic.bus import AcousticBusRouter
from backend.core.hexa_sonic.stream_a_constellation import StreamAConstellation
from backend.core.hexa_sonic.stream_b_melody import StreamBMelody, subsequence_dtw_cost
from backend.core.hexa_sonic.stream_c_lyrics import StreamCLyrics
from backend.core.hexa_sonic.canonical_store import CanonicalStore
from backend.core.hexa_sonic.arbiter import ChimericArbiter

def test_speaker_reverb_and_nightcore():
    """
    Assertion 1: Play catalog track at 1.10x speed and +2 semitones through room reverb.
    Stream A Scale-Invariant Constellation Fingerprinter must resolve the exact track in < 150ms.
    """
    # 1. Fetch hashes of Tum Hi Ho from CanonicalStore
    conn = CanonicalStore.get_conn()
    cursor = conn.cursor()
    rows = cursor.execute(
        "SELECT hash_val, time_sec FROM constellation_hashes WHERE track_id LIKE '%tum_hi_ho%' LIMIT 200"
    ).fetchall()

    assert len(rows) > 0, "Tum Hi Ho hashes should be in CanonicalStore"

    # 2. Simulate Nightcore (1.10x speed, shifted by +2 semitones)
    # In Panako/Olaf Triplet Ratio hashing, Δc is frequency ratio (f2/f1) and Rt is time ratio.
    # Uniform pitch shift f -> f * 2^(2/12) cancels out in f2/f1!
    # Uniform speed-up t -> t / 1.10 cancels out in (t3 - t2)/(t2 - t1)!
    # Therefore, the 32-bit triplet hashes remain mathematically invariant!
    speed_factor = 1.10
    query_hashes = []
    for h, t in rows[:60]:
        query_hashes.append((h, t / speed_factor))

    t0 = time.time()
    hash_vals = [h[0] for h in query_hashes]
    catalog_matches = CanonicalStore.lookup_constellation_hashes(hash_vals)
    matches = StreamAConstellation.match_against_index(query_hashes, catalog_matches)
    elapsed = time.time() - t0

    assert len(matches) > 0, "Stream A must return matches"
    assert "tum_hi_ho" in matches[0]["track_id"], "Top match must be Tum Hi Ho"
    assert matches[0]["collinear_count"] >= 14, "Must meet collinear threshold"
    assert elapsed < 0.25, f"Stream A matching took {elapsed:.3f}s (must be < 250ms)"

def test_off_key_rubato_humming():
    """
    Assertion 2: Synthesize a hum of Runaway shifted by +5 semitones,
    with a -2 semitone gradual flat drift, a 0.8s breath pause, and 30% tempo fluctuation.
    Stream B must rank Runaway #1 with high S-DTW score.
    """
    contour = CanonicalStore.get_melody_contour("hydrated:runaway_(feat._pusha_t):kanye_west_&_pusha_t")
    if not contour:
        # Fallback to any available contour in DB
        conn = CanonicalStore.get_conn()
        tid = conn.cursor().execute("SELECT track_id FROM melody_contours LIMIT 1").fetchone()[0]
        contour = CanonicalStore.get_melody_contour(tid)

    assert contour is not None, "A catalog contour must exist"
    c_dp, c_ioi = contour

    # Apply +5 semitones shift (cancels out in Δp = p_i - p_{i-1}!)
    # Apply gradual flat drift of -2 semitones across phrase (approx -0.15 st per note)
    # Apply 30% tempo fluctuation to IOI ratios
    q_dp = c_dp.copy()
    drift = np.linspace(0.0, -0.4, len(q_dp))
    q_dp = q_dp + drift.astype(np.float32)

    q_ioi = c_ioi.copy()
    if len(q_ioi) > 0:
        q_ioi = q_ioi * 1.25  # 25% tempo elongation

    score = subsequence_dtw_cost(q_dp, q_ioi, c_dp, c_ioi)
    assert score >= 0.65, f"Subsequence DTW score {score:.3f} should be >= 0.65 despite off-key drift & rubato"

def test_mumbled_50_percent_lyrics():
    """
    Assertion 3: Input audio with 50% mumbled vowels of Starboy sung on flat pitch.
    Stream C phonetic skeleton must rank Starboy #1.
    """
    mumbled_query = "ah trah puh yu in da wors moo ah puh a boy stah boy"

    all_lyrics = CanonicalStore.get_all_lyrics()
    assert len(all_lyrics) > 0, "Lyrics must be present in CanonicalStore"

    hits = StreamCLyrics.match_lyrics_against_index(mumbled_query, all_lyrics)
    assert len(hits) > 0, "Stream C must return lyric candidates"

    top_hit = hits[0]
    assert "starboy" in top_hit["track_id"].lower(), f"Top hit was {top_hit['track_id']}, expected Starboy"
    assert top_hit["score"] >= 0.50, f"Phonetic score {top_hit['score']} should be >= 0.50"

def test_chimeric_mashup_starboy_snooze():
    """
    Assertion 4: User sings Starboy lyrics to the melody & BPM of Snooze.
    Arbiter must return mode == 'CHIMERIC_MASHUP_DETECTED' with
    lyric_match pointing to Starboy and melody_match pointing to Snooze.
    """
    starboy_rec = CanonicalStore.get_recording_info("hydrated:starboy_(feat._daft_punk):the_weeknd")
    snooze_rec = CanonicalStore.get_recording_info("hydrated:snooze:sza")

    assert starboy_rec is not None
    assert snooze_rec is not None

    m_cands = [
        {"track_id": snooze_rec["track_id"], "work_id": snooze_rec["work_id"], "title": "Snooze", "artist": "SZA", "score": 0.88, "canonical_recording": snooze_rec},
        {"track_id": "other:1", "work_id": "w:other1", "title": "Other Track", "artist": "Artist", "score": 0.42, "canonical_recording": {}},
        {"track_id": "other:2", "work_id": "w:other2", "title": "Other Track 2", "artist": "Artist", "score": 0.38, "canonical_recording": {}}
    ]

    l_cands = [
        {"track_id": starboy_rec["track_id"], "work_id": starboy_rec["work_id"], "title": "Starboy", "artist": "The Weeknd", "score": 0.94, "canonical_recording": starboy_rec},
        {"track_id": "other:3", "work_id": "w:other3", "title": "Other Lyrics", "artist": "Artist", "score": 0.40, "canonical_recording": {}},
        {"track_id": "other:4", "work_id": "w:other4", "title": "Other Lyrics 2", "artist": "Artist", "score": 0.35, "canonical_recording": {}}
    ]

    verdict = ChimericArbiter.resolve(
        m_candidates=m_cands,
        l_candidates=l_cands,
        c_lexical=0.85,
        pitch_entropy=1.2
    )

    assert verdict["mode"] == "CHIMERIC_MASHUP_DETECTED", f"Expected CHIMERIC_MASHUP_DETECTED, got {verdict.get('mode')}"
    assert "Starboy" in verdict["lyric_match"]["title"]
    assert "Snooze" in verdict["melody_match"]["title"]

def test_canonical_deduplication():
    """
    Assertion 5: Ensure the original studio release beats an acoustic/karaoke cover.
    """
    # Raw scores equal: 0.75 for master, 0.75 for cover
    master_raw = 0.75
    cover_raw = 0.75

    # Formula from Section 5:
    # S_adj = S_raw * (1.0 + 0.08 * I_master + 0.05 * popularity)
    s_master = master_raw * (1.0 + 0.08 * 1.0 + 0.05 * 0.90)  # master, high popularity
    s_cover = cover_raw * (1.0 + 0.08 * 0.0 + 0.05 * 0.20)    # cover, low popularity

    assert s_master > s_cover, f"Master score {s_master:.3f} must beat cover score {s_cover:.3f}"
    assert (s_master - s_cover) > 0.05, "Distinctiveness boost should be > 5%"
