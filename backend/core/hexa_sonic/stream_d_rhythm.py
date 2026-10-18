import numpy as np
import librosa
from numba import njit
from typing import List, Tuple, Dict, Any, Optional

@njit(fastmath=True)
def rhythm_s_dtw_cost(q_r: np.ndarray, c_r: np.ndarray) -> float:
    """1D Subsequence DTW on IOI ratios."""
    M = len(q_r)
    L = len(c_r)
    if M < 2 or L < M:
        return 0.0

    D = np.full((M + 1, L + 1), np.inf, dtype=np.float32)
    for j in range(L + 1):
        D[0, j] = 0.0

    for i in range(1, M + 1):
        for j in range(1, L + 1):
            cost = abs(q_r[i - 1] - c_r[j - 1])
            min_prev = min(D[i - 1, j - 1], D[i - 1, j] + 0.5, D[i, j - 1] + 0.5)
            D[i, j] = cost + min_prev

    min_final = float(np.min(D[M, 1:])) / float(M)
    return float(np.exp(-0.85 * min_final))

class StreamDRhythm:
    """
    Section 4 Stream D: Monotone Rhythm & Beatbox Engine.
    Active when pitch entropy is near zero (desk tapping, beatboxing, monotone cadence).
    """

    SR = 16000
    HOP_LENGTH = 160

    @classmethod
    def compute_pitch_entropy(cls, f0: np.ndarray) -> float:
        """
        Calculates Shannon entropy of pitch variation.
        Near 0.0 for monotone humming/tapping, > 1.5 for melodic singing.
        """
        voiced = f0[f0 > 65.0]
        if len(voiced) < 10:
            return 0.0
        # Quantize to semitones
        midi = 69.0 + 12.0 * np.log2(voiced / 440.0)
        hist, _ = np.histogram(midi, bins=24)
        p = hist / float(np.sum(hist))
        p = p[p > 0]
        return float(-np.sum(p * np.log2(p)))

    @classmethod
    def extract_onsets_and_iois(cls, audio_bus2: np.ndarray) -> Tuple[np.ndarray, float]:
        """
        Extracts onsets via spectral flux and computes sequence of log2 IOI ratios.
        Returns: (r_ioi, estimated_bpm)
        """
        if len(audio_bus2) < cls.SR:
            return np.array([], dtype=np.float32), 0.0

        onset_env = librosa.onset.onset_strength(y=audio_bus2, sr=cls.SR, hop_length=cls.HOP_LENGTH)
        onset_frames = librosa.onset.onset_detect(
            onset_envelope=onset_env,
            sr=cls.SR,
            hop_length=cls.HOP_LENGTH,
            backtrack=False
        )

        times = librosa.frames_to_time(onset_frames, sr=cls.SR, hop_length=cls.HOP_LENGTH)
        if len(times) < 3:
            return np.array([], dtype=np.float32), 0.0

        iois = np.diff(times)
        iois = np.maximum(iois, 0.06)

        # Log2 ratios
        ratios = np.clip(np.log2(iois[1:] / iois[:-1]), -3.0, 3.0)

        # BPM estimation via tempo
        tempo, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=cls.SR, hop_length=cls.HOP_LENGTH)
        bpm = float(tempo[0] if isinstance(tempo, (list, np.ndarray)) else tempo)

        return ratios.astype(np.float32), round(bpm, 1)
