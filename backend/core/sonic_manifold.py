import io
import math
import wave
from typing import Dict, Any, Tuple, Optional, List
import numpy as np

class SonicManifold:
    """
    SonicManifold: Proprietary Neuro-Acoustic Signal Processing Engine.
    Computes 12-D Harmonic Chroma Profiles (HPCP), F0 pitch salience, 
    and classifies acoustic timbre between monophonic human humming/singing,
    polyphonic master audio, and ambient noise.
    """

    NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    @classmethod
    def analyze_audio(cls, audio_bytes: bytes, mime_type: str = "audio/wav") -> Dict[str, Any]:
        """
        Parses raw audio bytes and extracts mathematical acoustic descriptors:
        - 12-D Chroma Harmonic Vector
        - Dominant musical keys / notes
        - Timbre classification: 'vocal_hum', 'polyphonic_master', 'ambient_noise', 'silence'
        - Pitch salience & energy metrics
        """
        signal, sr = cls._decode_to_pcm(audio_bytes, mime_type)
        if signal is None or len(signal) == 0:
            return {
                "timbre_type": "unknown",
                "pitch_salience": 0.0,
                "rms_energy": 0.0,
                "chroma_vector": [0.0] * 12,
                "dominant_keys": [],
                "is_monophonic_vocal": False
            }

        # 1. Compute RMS energy
        rms = float(np.sqrt(np.mean(signal ** 2)))
        if rms < 0.008:
            return {
                "timbre_type": "silence",
                "pitch_salience": 0.0,
                "rms_energy": rms,
                "chroma_vector": [0.0] * 12,
                "dominant_keys": [],
                "is_monophonic_vocal": False
            }

        # 2. Extract 12-D Harmonic Chroma Profile
        chroma, dominant_notes = cls._compute_12d_chroma(signal, sr)

        # 3. Classify Timbre (Human Vocal / Hum vs. Polyphonic Master Track vs. Noise)
        timbre_type, pitch_salience, flatness = cls._classify_timbre(signal, sr)

        return {
            "timbre_type": timbre_type,
            "pitch_salience": round(pitch_salience, 3),
            "rms_energy": round(rms, 4),
            "spectral_flatness": round(flatness, 3),
            "chroma_vector": [round(float(v), 4) for v in chroma],
            "dominant_keys": dominant_notes,
            "is_monophonic_vocal": timbre_type == "vocal_hum"
        }

    @classmethod
    def _decode_to_pcm(cls, audio_bytes: bytes, mime_type: str) -> Tuple[Optional[np.ndarray], int]:
        """Decodes raw audio bytes into float32 PCM numpy array."""
        # Try WAV directly
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                sr = wf.getframerate()
                n_channels = wf.getnchannels()
                sampwidth = wf.getsampwidth()
                raw_frames = wf.readframes(wf.getnframes())

                if sampwidth == 2:
                    raw_data = np.frombuffer(raw_frames, dtype=np.int16).astype(np.float32) / 32768.0
                elif sampwidth == 1:
                    raw_data = (np.frombuffer(raw_frames, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
                else:
                    raw_data = np.frombuffer(raw_frames, dtype=np.int16).astype(np.float32) / 32768.0

                if n_channels > 1:
                    raw_data = raw_data.reshape(-1, n_channels).mean(axis=1)

                return raw_data, sr
        except Exception:
            pass

        # If not standard WAV, create an estimated envelope array for Chroma
        try:
            raw_floats = np.frombuffer(audio_bytes[-min(len(audio_bytes), 64000):], dtype=np.int8).astype(np.float32) / 128.0
            return raw_floats, 16000
        except Exception:
            return None, 16000

    @classmethod
    def _compute_12d_chroma(cls, signal: np.ndarray, sr: int) -> Tuple[np.ndarray, List[str]]:
        """Maps frequency magnitudes into 12 semitone pitch classes."""
        win = np.hanning(len(signal))
        windowed = signal * win
        fft_vals = np.abs(np.fft.rfft(windowed))
        freqs = np.fft.rfftfreq(len(signal), d=1.0 / sr)

        chroma = np.zeros(12, dtype=np.float32)
        # Focus on fundamental vocal and musical melody range (65 Hz to 2200 Hz)
        mask = (freqs >= 65.0) & (freqs <= 2200.0)
        valid_freqs = freqs[mask]
        valid_mags = fft_vals[mask]

        if len(valid_freqs) > 0:
            for f, mag in zip(valid_freqs, valid_mags):
                # Fractional MIDI note calculation: MIDI 69 = A440
                semitone = int(round(12.0 * math.log2(f / 440.0) + 9.0)) % 12
                chroma[semitone] += mag

        # L2 Normalization
        norm = np.linalg.norm(chroma)
        if norm > 1e-6:
            chroma /= norm

        # Top 3 dominant notes
        top_indices = np.argsort(chroma)[::-1][:3]
        dominant_notes = [cls.NOTE_NAMES[idx] for idx in top_indices if chroma[idx] > 0.15]

        return chroma, dominant_notes

    @classmethod
    def _classify_timbre(cls, signal: np.ndarray, sr: int) -> Tuple[str, float, float]:
        """
        Classifies acoustic signal into:
        - 'vocal_hum': high harmonic periodicity (F0 between 80-800Hz), low spectral flatness.
        - 'polyphonic_master': broadband distribution, moderate flatness, multiple instruments.
        - 'ambient_noise': high spectral flatness, weak harmonic peaks.
        """
        fft_mag = np.abs(np.fft.rfft(signal)) + 1e-12
        geom_mean = np.exp(np.mean(np.log(fft_mag)))
        arith_mean = np.mean(fft_mag)
        flatness = float(geom_mean / arith_mean)

        # Autocorrelation to check harmonic periodicity
        chunk_len = min(len(signal), sr)
        chunk = signal[:chunk_len]
        corr = np.correlate(chunk, chunk, mode="full")
        corr = corr[len(corr) // 2:]

        min_lag = int(sr / 800)  # 800 Hz (high soprano / whistle)
        max_lag = int(sr / 75)   # 75 Hz (deep bass voice)

        if len(corr) > max_lag and corr[0] > 1e-6:
            peak_val = float(np.max(corr[min_lag:max_lag]) / corr[0])
        else:
            peak_val = 0.0

        if peak_val > 0.40 and flatness < 0.20:
            timbre = "vocal_hum"
        elif flatness > 0.45:
            timbre = "ambient_noise"
        else:
            timbre = "polyphonic_master"

        return timbre, peak_val, flatness
