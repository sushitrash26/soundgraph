#!/usr/bin/env python3
"""
SoundGraph Audio Forge — Interactive End-to-End Demo Script
Synthesizes a test track, uploads it to FastAPI, separates stems, applies taste transformation,
mixes stems with volume faders, and exports the master remix.
"""

import os
import sys
import time
import numpy as np
import scipy.io.wavfile as wavfile
from fastapi.testclient import TestClient

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app

def generate_sample_audio(filename: str = "demo_song.wav"):
    """Generates a 4-second multi-instrument test WAV (Drums + Bass + Melody Lead)."""
    sr = 44100
    t = np.linspace(0, 4.0, int(sr * 4.0), endpoint=False)
    
    # 60Hz Sub Bass
    bass = 0.45 * np.sin(2 * np.pi * 60 * t)
    # 880Hz / 1320Hz Melody Lead (Arpeggiated)
    melody = 0.3 * np.sin(2 * np.pi * 880 * t) * (np.sin(2 * np.pi * 2 * t) > 0)
    # 4-on-the-floor Kick / Snare Transients
    drums = np.zeros_like(t)
    for beat in np.arange(0, 4.0, 0.5):
        idx = int(beat * sr)
        drums[idx:idx + int(0.04 * sr)] = np.random.uniform(-0.6, 0.6, int(0.04 * sr))

    mix = bass + melody + drums
    mix_stereo = np.column_stack([mix, mix])
    mix_int16 = (np.clip(mix_stereo, -1.0, 1.0) * 32767.0).astype(np.int16)
    
    wavfile.write(filename, sr, mix_int16)
    print(f"🎵 Generated 4-second sample audio: {filename}")
    return filename

def run_demo():
    print("\n" + "="*70)
    print("🚀 STARTING SOUNDGRAPH AUDIO FORGE END-TO-END DEMO")
    print("="*70 + "\n")

    client = TestClient(app)
    demo_file = "demo_song.wav"
    generate_sample_audio(demo_file)

    try:
        # Step 1: Upload & Analyze Track
        print("\n[Step 1/5] Analyzing audio track with Gemini 1.5 Flash...")
        with open(demo_file, "rb") as f:
            resp = client.post(
                "/audio/analyze",
                files={"file": (demo_file, f, "audio/wav")},
                data={"user_id": "demo_guest_user"}
            )
        assert resp.status_code == 200, f"Analyze failed: {resp.text}"
        manifest = resp.json()
        print(f"✅ Analyzed: '{manifest['song_title']}' | BPM: {manifest['bpm']} | Key: {manifest['musical_key']}")
        print(f"   Emotional Profile: {manifest['emotional_profile']}")
        print(f"   Detected Instruments ({len(manifest['detected_instruments'])}):")
        for inst in manifest['detected_instruments']:
            print(f"    - [{inst['instrument']}] ({inst['role']}): {inst['description']}")

        job_id = manifest.get("job_id")
        print(f"\n📁 Active Job ID: {job_id}")

        # Step 2: Trigger Stem Separation
        print("\n[Step 2/5] Triggering CPU stem separation & adaptive -45dB noise gate...")
        sep_resp = client.post(f"/audio/separate/{job_id}?user_id=demo_guest_user")
        assert sep_resp.status_code == 200, f"Separate failed: {sep_resp.text}"
        
        # Wait a moment for background separation
        time.sleep(2.0)
        status_resp = client.get(f"/audio/job/{job_id}/status")
        job_status = status_resp.json()
        print(f"✅ Status: {job_status['status']} | Progress: {job_status['progress_percent']}%")
        print(f"   Isolated Stems ({len(job_status['stems'])}):")
        for s in job_status['stems']:
            print(f"    - {s['stem_id']} -> {s['instrument']} ({s['duration_sec']}s, RMS: {s['rms_energy']})")

        # Step 3: Transform a Stem (Taste Mode)
        print("\n[Step 3/5] Transforming stem via Neo4j Taste Centroid ('Make it match my taste')...")
        tx_resp = client.post("/audio/stem/transform", json={
            "stem_id": "stem_vocals",
            "mode": "taste",
            "user_id": "demo_guest_user"
        })
        assert tx_resp.status_code == 200, f"Transform failed: {tx_resp.text}"
        tx_data = tx_resp.json()
        print(f"✅ Taste Transformation Applied:")
        print(f"   Description: {tx_data['description']}")
        print(f"   DSP Params:  {tx_data['applied_parameters']}")

        # Step 4: Transform a Stem (Prompt Mode)
        print("\n[Step 4/5] Transforming stem via Text Prompt ('Make it warm electric guitar with distortion')...")
        prompt_resp = client.post("/audio/stem/transform", json={
            "stem_id": "stem_other",
            "mode": "prompt",
            "prompt": "make it warm electric guitar with tube saturation and plate reverb"
        })
        assert prompt_resp.status_code == 200, f"Prompt transform failed: {prompt_resp.text}"
        p_data = prompt_resp.json()
        print(f"✅ Prompt Transformation Applied:")
        print(f"   Description: {p_data['description']}")
        print(f"   DSP Params:  {p_data['applied_parameters']}")

        # Step 5: Remix & Export Master
        print("\n[Step 5/5] Mixing stems with custom volume faders and exporting to -14 LUFS...")
        remix_resp = client.post("/audio/remix/export", json={
            "job_id": job_id,
            "remix_title": "My SoundGraph Custom Remix",
            "master_gain_db": 0.0,
            "stems": [
                {"stem_id": "stem_drums", "volume_db": -1.0, "pan": 0.0, "is_muted": False},
                {"stem_id": "stem_bass", "volume_db": +1.5, "pan": 0.0, "is_muted": False},
                {"stem_id": "stem_vocals", "volume_db": 0.0, "pan": -0.2, "is_muted": False},
                {"stem_id": "stem_other", "volume_db": -2.0, "pan": +0.3, "is_muted": False}
            ]
        })
        assert remix_resp.status_code == 200, f"Remix export failed: {remix_resp.text}"
        remix_data = remix_resp.json()
        print(f"🎉 MASTER REMIX EXPORTED SUCCESSFULLY!")
        print(f"   File URL:         {remix_data['file_url']}")
        print(f"   Duration:         {remix_data['duration_sec']}s")
        print(f"   Loudness Target:  {remix_data['integrated_lufs']} LUFS")
        print(f"   Active Stems:     {remix_data['stems_used_count']}")

        print("\n" + "="*70)
        print("✨ ALL 5 PIPELINE PHASES VERIFIED AND OPERATIONAL!")
        print("="*70 + "\n")

    finally:
        if os.path.exists(demo_file):
            os.remove(demo_file)

if __name__ == "__main__":
    run_demo()
