import io
import math
import wave
from typing import Dict, Any, Tuple, Optional, List
import numpy as np

import subprocess
import tempfile

class SonicManifold:
    """
    SonicManifold: Proprietary Neuro-Acoustic Signal Processing Engine.
    Computes 12-D Harmonic Chroma Profiles (HPCP), F0 pitch salience, 
    BPM tempo, Chromaprint acoustic fingerprints, and timbre classification.
    """

    NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    @classmethod
    def analyze_audio(cls, audio_bytes: bytes, mime_type: str = "audio/wav") -> Dict[str, Any]:
        """
        Parses raw audio bytes and extracts mathematical acoustic descriptors:
        - 12-D Chroma Harmonic Vector
        - Dominant musical keys / notes
        - BPM tempo estimation
        - Chromaprint landmark fingerprint
        - Timbre classification
        """
        signal, sr = cls._decode_to_pcm(audio_bytes, mime_type)
        if signal is None or len(signal) == 0:
            return {
                "timbre_type": "unknown",
                "pitch_salience": 0.0,
                "rms_energy": 0.0,
                "chroma_vector": [0.0] * 12,
                "dominant_keys": [],
                "tempo_bpm": 0.0,
                "fingerprint": None,
                "is_monophonic_vocal": False
            }

        # 1. Compute RMS energy
        rms = float(np.sqrt(np.mean(signal ** 2)))
        if rms < 0.005:
            return {
                "timbre_type": "silence",
                "pitch_salience": 0.0,
                "rms_energy": rms,
                "chroma_vector": [0.0] * 12,
                "dominant_keys": [],
                "tempo_bpm": 0.0,
                "fingerprint": None,
                "is_monophonic_vocal": False
            }

        # 2. Extract 12-D Harmonic Chroma Profile
        chroma, dominant_notes = cls._compute_12d_chroma(signal, sr)

        # 3. Classify Timbre
        timbre_type, pitch_salience, flatness = cls._classify_timbre(signal, sr)

        # 4. Compute Tempo (BPM)
        tempo = cls._compute_tempo(signal, sr)

        # 5. Extract Chromaprint Fingerprint
        fp = cls._compute_fingerprint(audio_bytes)

        return {
            "timbre_type": timbre_type,
            "pitch_salience": round(pitch_salience, 3),
            "rms_energy": round(rms, 4),
            "spectral_flatness": round(flatness, 3),
            "chroma_vector": [round(float(v), 4) for v in chroma],
            "dominant_keys": dominant_notes,
            "tempo_bpm": tempo,
            "fingerprint": fp,
            "is_monophonic_vocal": timbre_type == "vocal_hum"
        }

    @classmethod
    def _decode_to_pcm(cls, audio_bytes: bytes, mime_type: str) -> Tuple[Optional[np.ndarray], int]:
        """Decodes audio bytes into float32 PCM numpy array using ffmpeg pipe."""
        # 1. Use ffmpeg for fast, lossless decoding of any container (.m4a, .aac, .webm, .wav, .mp3)
        try:
            cmd = [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", "16000", "pipe:1"
            ]
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            out, _ = proc.communicate(input=audio_bytes, timeout=4.0)
            if out and len(out) > 0:
                pcm = np.frombuffer(out, dtype=np.int16).astype(np.float32) / 32768.0
                return pcm, 16000
        except Exception:
            pass

        # 2. Direct WAV fallback
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                sr = wf.getframerate()
                n_channels = wf.getnchannels()
                raw_frames = wf.readframes(wf.getnframes())
                raw_data = np.frombuffer(raw_frames, dtype=np.int16).astype(np.float32) / 32768.0
                if n_channels > 1:
                    raw_data = raw_data.reshape(-1, n_channels).mean(axis=1)
                return raw_data, sr
        except Exception:
            pass

        return None, 16000

    @classmethod
    def _compute_tempo(cls, signal: np.ndarray, sr: int = 16000) -> float:
        """Estimates musical tempo (BPM) from onset energy autocorrelation."""
        try:
            hop = int(sr * 0.02)  # 20ms
            flen = int(sr * 0.04) # 40ms
            n_frames = (len(signal) - flen) // hop
            if n_frames < 60:
                return 0.0

            env = np.array([
                np.sum(signal[i * hop : i * hop + flen] ** 2)
                for i in range(n_frames)
            ])
            onset = np.maximum(0, np.diff(env))
            if np.max(onset) > 0:
                onset /= np.max(onset)

            fps = sr / hop  # 50 fps
            corr = np.correlate(onset, onset, mode="full")[len(onset)-1:]
            min_lag = int(fps * 60 / 180)  # 180 BPM
            max_lag = int(fps * 60 / 60)   # 60 BPM

            if len(corr) > max_lag and corr[0] > 1e-6:
                best_lag = min_lag + int(np.argmax(corr[min_lag:max_lag]))
                bpm = (fps * 60.0) / best_lag
                return round(float(bpm), 1)
        except Exception:
            pass
        return 0.0

    @classmethod
    def _compute_fingerprint(cls, audio_bytes: bytes) -> Optional[str]:
        """Generates Chromaprint acoustic fingerprint using fpcalc."""
        try:
            with tempfile.NamedTemporaryFile(suffix=".m4a", delete=True) as tmp:
                tmp.write(audio_bytes)
                tmp.flush()
                res = subprocess.run(
                    ["fpcalc", "-json", tmp.name],
                    capture_output=True,
                    text=True,
                    timeout=3.0
                )
                if res.returncode == 0 and res.stdout:
                    data = json.loads(res.stdout)
                    return data.get("fingerprint")
        except Exception:
            pass
        return None

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
