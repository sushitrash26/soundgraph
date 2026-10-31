import os
import shutil
import tempfile
import numpy as np
import scipy.io.wavfile as wavfile
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.audio_forge.stem_separator import StemSeparator
from backend.services.audio_forge.multimodal_embedder import MultimodalAudioEmbedder
from backend.services.audio_forge.taste_styler import TasteStyler
from backend.services.audio_forge.stem_transformer import StemTransformer
from backend.services.audio_forge.remix_mixer import RemixMixer
from backend.models.audio_forge import RemixStemTrack

@pytest.fixture
def temp_audio_dir():
    d = tempfile.mkdtemp()
    yield d
    shutil.rmtree(d, ignore_errors=True)

@pytest.fixture
def synthetic_wav_file(temp_audio_dir):
    """Generates a 3-second synthetic audio mixture (bass + lead + drums)."""
    sr = 44100
    t = np.linspace(0, 3.0, int(sr * 3.0), endpoint=False)
    
    # 60Hz Bass
    bass = 0.4 * np.sin(2 * np.pi * 60 * t)
    # 1000Hz Melody Lead
    lead = 0.3 * np.sin(2 * np.pi * 1000 * t)
    # Percussive transient bursts
    drums = np.zeros_like(t)
    for onset in [0.0, 0.5, 1.0, 1.5, 2.0, 2.5]:
        idx = int(onset * sr)
        burst_len = int(0.05 * sr)
        drums[idx:idx + burst_len] = np.random.uniform(-0.5, 0.5, burst_len)

    mix = bass + lead + drums
    mix_stereo = np.column_stack([mix, mix])
    mix_int16 = (np.clip(mix_stereo, -1.0, 1.0) * 32767.0).astype(np.int16)

    filepath = os.path.join(temp_audio_dir, "test_mix.wav")
    wavfile.write(filepath, sr, mix_int16)
    return filepath

def test_adaptive_spectral_noise_gate():
    """Verifies that the adaptive noise gate attenuates silent bleed while preserving active signal."""
    sr = 44100
    t = np.linspace(0, 1.0, sr, endpoint=False)
    
    # First 0.5s is active signal (-6 dBFS), second 0.5s is low bleed noise (-55 dBFS)
    active = 0.5 * np.sin(2 * np.pi * 440 * t[:sr//2])
    bleed = 0.001 * np.random.uniform(-1.0, 1.0, sr - (sr//2))  # ~ -60 dBFS
    
    raw = np.concatenate([active, bleed])
    gated = StemSeparator.apply_spectral_noise_gate(raw, sr=sr, threshold_db=-45.0)

    # Active segment energy should remain high
    active_energy = np.mean(gated[:sr//2]**2)
    assert active_energy > 0.05

    # Bleed segment energy should be gated close to 0
    bleed_energy = np.mean(gated[sr//2:]**2)
    assert bleed_energy < 1e-6

def test_stem_separation_librosa_filterbank(synthetic_wav_file, temp_audio_dir):
    """Verifies that the CPU stem separation splits the mix into 4 de-bleeded stems."""
    out_dir = os.path.join(temp_audio_dir, "stems")
    stems = StemSeparator.separate_stems(synthetic_wav_file, out_dir)

    assert len(stems) == 4
    inst_names = {s.instrument for s in stems}
    assert "drums" in inst_names
    assert "bass" in inst_names
    assert "vocals" in inst_names
    assert "other" in inst_names

    for s in stems:
        assert os.path.exists(s.file_path)
        assert s.duration_sec >= 2.9
        assert s.rms_energy > 0.0

def test_multimodal_audio_embedder_deterministic_fallback():
    """Verifies 768-D unit normalization in shared audio-text embedding space."""
    fake_audio = b"RIFF" + b"\x00" * 1000
    vec_audio = MultimodalAudioEmbedder._deterministic_audio_vector(fake_audio)
    assert len(vec_audio) == 768
    norm_audio = np.linalg.norm(vec_audio)
    assert np.isclose(norm_audio, 1.0, atol=1e-3)

    vec_text = MultimodalAudioEmbedder._deterministic_text_vector("electric guitar lead")
    assert len(vec_text) == 768
    norm_text = np.linalg.norm(vec_text)
    assert np.isclose(norm_text, 1.0, atol=1e-3)

def test_taste_styler_derivation():
    """Verifies extraction of user acoustic centroid and translation into DSP parameters."""
    dsp_params, explanation = TasteStyler.derive_dsp_parameters_from_taste(
        user_id="test_user",
        instrument="guitar",
        stem_energy=0.4
    )
    assert isinstance(dsp_params, dict)
    assert "reverb_wet" in dsp_params
    assert "saturation_gain_db" in dsp_params
    assert len(explanation) > 10

def test_stem_transformer_dsp(synthetic_wav_file, temp_audio_dir):
    """Verifies DSP modification pipeline creates valid transformed output."""
    import asyncio
    out_path = os.path.join(temp_audio_dir, "transformed_stem.wav")
    resp = asyncio.run(StemTransformer.transform_stem(
        stem_path=synthetic_wav_file,
        output_path=out_path,
        mode="prompt",
        prompt="make it warm electric guitar with subtle distortion",
        instrument="guitar"
    ))
    assert os.path.exists(out_path)
    assert resp.transformed_stem_id != ""
    assert "description" in resp.model_dump()

def test_remix_mixer_numpy_fallback(synthetic_wav_file, temp_audio_dir):
    """Verifies multi-track mixer with volume, pan, and true-peak normalization."""
    stem_tracks = [
        RemixStemTrack(stem_id="stem_1", volume_db=-1.0, pan=-0.5),
        RemixStemTrack(stem_id="stem_2", volume_db=-2.0, pan=0.5),
        RemixStemTrack(stem_id="stem_3", volume_db=0.0, is_muted=True)  # Muted stem
    ]
    paths = {
        "stem_1": synthetic_wav_file,
        "stem_2": synthetic_wav_file,
        "stem_3": synthetic_wav_file
    }
    out_master = os.path.join(temp_audio_dir, "master_remix.wav")
    res = RemixMixer.mix_and_export(
        stems=stem_tracks,
        stem_paths=paths,
        output_file_path=out_master,
        master_gain_db=0.0,
        remix_title="Test Remix Master"
    )
    assert os.path.exists(out_master)
    assert res.stems_used_count == 2
    assert res.integrated_lufs == -14.0

def test_fastapi_audio_analyze_endpoint(synthetic_wav_file):
    """Verifies that FastAPI /audio/analyze accepts uploaded audio and returns manifest."""
    client = TestClient(app)
    with open(synthetic_wav_file, "rb") as f:
        resp = client.post(
            "/audio/analyze",
            files={"file": ("test_mix.wav", f, "audio/wav")},
            data={"user_id": "test_user"}
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "bpm" in data
    assert "detected_instruments" in data
    assert len(data["detected_instruments"]) >= 2
