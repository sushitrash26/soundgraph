import math
import numpy as np
import librosa
from numba import njit, prange
from scipy import ndimage
from typing import List, Tuple, Dict, Any, Optional

@njit(fastmath=True)
def subsequence_dtw_cost(
    q_dp: np.ndarray,
    q_ioi: np.ndarray,
    c_dp: np.ndarray,
    c_ioi: np.ndarray,
    pitch_weight: float = 0.75,
    rhythm_weight: float = 0.25
) -> float:
    """
    Computes Subsequence Dynamic Time Warping (S-DTW) between user query (M)
    and catalog segment (L). Allows query to start and end anywhere within C.
    Normalized by query length M.
    Returns: similarity in [0.0, 1.0].
    """
    M = len(q_dp)
    L = len(c_dp)
    if M < 2 or L < M:
        return 0.0

    D = np.full((M + 1, L + 1), np.inf, dtype=np.float32)
    for j in range(L + 1):
        D[0, j] = 0.0

    for i in range(1, M + 1):
        for j in range(1, L + 1):
            diff_p = abs(q_dp[i - 1] - c_dp[j - 1])
            # Octave jump tolerance (e.g. singing an octave lower/higher)
            if 10.5 < diff_p < 13.5:
                diff_p = abs(diff_p - 12.0) + 0.5
            elif 22.5 < diff_p < 25.5:
                diff_p = abs(diff_p - 24.0) + 1.0

            diff_r = abs(q_ioi[i - 1] - c_ioi[j - 1])
            cost = pitch_weight * diff_p + rhythm_weight * diff_r

            d_match = D[i - 1, j - 1]
            d_ins = D[i - 1, j] + 0.6
            d_del = D[i, j - 1] + 0.6

            min_prev = d_match
            if d_ins < min_prev:
                min_prev = d_ins
            if d_del < min_prev:
                min_prev = d_del

            D[i, j] = cost + min_prev

    min_final = float(np.min(D[M, 1:])) / float(M)
    return float(np.exp(-1.15 * min_final))

@njit(parallel=True, fastmath=True)
def batch_subsequence_dtw(
    q_dp: np.ndarray,
    q_ioi: np.ndarray,
    candidate_dps: np.ndarray,
    candidate_iois: np.ndarray,
    lengths: np.ndarray
) -> np.ndarray:
    """Parallel batch computation across Top K candidates."""
    n_cands = len(lengths)
    scores = np.zeros(n_cands, dtype=np.float32)
    for k in prange(n_cands):
        L = lengths[k]
        c_dp = candidate_dps[k, :L]
        c_ioi = candidate_iois[k, :L]
        scores[k] = subsequence_dtw_cost(q_dp, q_ioi, c_dp, c_ioi)
    return scores

class StreamBMelody:
    """
    Section 4 Stream B: Key-Invariant, Drift-Immune, & Tempo-Invariant Melody Engine.
    1. Pitch contour tracking (F0, v(t)) at 10ms hop size.
    2. Discrete Note Event segmentation.
    3. Interval deltas (Δp) & Inter-Onset Interval ratios (r_IOI).
    4. Two-Stage Retrieval: 128-D coarse vector in FAISS -> Numba S-DTW fine matching.
    """

    SR = 16000
    HOP_LENGTH = 160  # 10ms at 16kHz
    F_MIN = 65.0      # C2
    F_MAX = 1100.0    # C6

    @classmethod
    def extract_pitch_contour(cls, audio_bus2: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Extracts fundamental frequency F0(t), voicing confidence v(t), and time axis.
        """
        if len(audio_bus2) < cls.HOP_LENGTH * 4:
            return np.array([]), np.array([]), np.array([])

        try:
            f0, voiced_flag, voiced_probs = librosa.pyin(
                audio_bus2,
                fmin=cls.F_MIN,
                fmax=cls.F_MAX,
                sr=cls.SR,
                hop_length=cls.HOP_LENGTH,
                fill_na=0.0
            )
            times = librosa.times_like(f0, sr=cls.SR, hop_length=cls.HOP_LENGTH)
            return f0.astype(np.float32), voiced_probs.astype(np.float32), times.astype(np.float32)
        except Exception:
            # Fast autocorrelation fallback if pyin fails on short snippet
            return cls._fast_autocorr_pitch(audio_bus2)

    @classmethod
    def _fast_autocorr_pitch(cls, audio: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Ultra-fast time-domain autocorrelation fallback."""
        n_frames = len(audio) // cls.HOP_LENGTH
        f0 = np.zeros(n_frames, dtype=np.float32)
        v = np.zeros(n_frames, dtype=np.float32)
        times = np.arange(n_frames, dtype=np.float32) * (cls.HOP_LENGTH / cls.SR)

        frame_len = cls.HOP_LENGTH * 4
        for i in range(n_frames - 3):
            start = i * cls.HOP_LENGTH
            frame = audio[start : start + frame_len]
            if len(frame) < frame_len:
                break
            corr = np.correlate(frame, frame, mode="full")[frame_len - 1 :]
            if corr[0] > 1e-6:
                norm_corr = corr / corr[0]
                min_lag = int(cls.SR / cls.F_MAX)
                max_lag = int(cls.SR / cls.F_MIN)
                if max_lag < len(norm_corr):
                    peak_lag = min_lag + int(np.argmax(norm_corr[min_lag:max_lag]))
                    peak_val = norm_corr[peak_lag]
                    if peak_val > 0.45:
                        f0[i] = float(cls.SR / peak_lag)
                        v[i] = float(peak_val)
        return f0, v, times

    @classmethod
    def segment_note_events(
        cls,
        f0: np.ndarray,
        voiced_probs: np.ndarray,
        times: np.ndarray
    ) -> List[Tuple[float, float, float]]:
        """
        Segments continuous F0 into discrete note events [(pitch_midi, onset_sec, duration_sec), ...].
        Rules:
        - Mask unvoiced frames where v(t) < 0.45 or F0 < 65Hz.
        - Convert to continuous MIDI: m(t) = 69 + 12 * log2(F0 / 440).
        - 5-frame median filter.
        - New note onset when |MIDI(t) - MIDI(t-1)| > 0.65 or unvoiced gap > 80ms.
        - Discard transient blips < 90ms.
        """
        if len(f0) == 0:
            return []

        # Mask unvoiced
        valid_mask = (voiced_probs >= 0.45) & (f0 >= cls.F_MIN)
        midi_pitch = np.zeros_like(f0)
        midi_pitch[valid_mask] = 69.0 + 12.0 * np.log2(f0[valid_mask] / 440.0)

        # 5-frame median filter on voiced pitch
        filtered_midi = ndimage.median_filter(midi_pitch, size=5)

        note_events = []
        in_note = False
        cur_pitches = []
        note_start = 0.0

        hop_sec = cls.HOP_LENGTH / cls.SR

        for t_idx in range(len(filtered_midi)):
            p = filtered_midi[t_idx]
            is_voiced = valid_mask[t_idx] and p > 0.0

            if is_voiced:
                if not in_note:
                    in_note = True
                    note_start = float(times[t_idx])
                    cur_pitches = [p]
                else:
                    prev_p = cur_pitches[-1]
                    if abs(p - prev_p) > 0.65:
                        # Note boundary triggered by pitch jump
                        duration = float(times[t_idx] - note_start)
                        if duration >= 0.09:
                            note_events.append((float(np.median(cur_pitches)), note_start, duration))
                        note_start = float(times[t_idx])
                        cur_pitches = [p]
                    else:
                        cur_pitches.append(p)
            else:
                if in_note:
                    duration = float(times[t_idx] - note_start)
                    if duration >= 0.09:
                        note_events.append((float(np.median(cur_pitches)), note_start, duration))
                    in_note = False
                    cur_pitches = []

        if in_note and len(cur_pitches) > 0:
            duration = float(times[-1] - note_start)
            if duration >= 0.09:
                note_events.append((float(np.median(cur_pitches)), note_start, duration))

        return note_events

    @classmethod
    def compute_deltas_and_iois(
        cls,
        note_events: List[Tuple[float, float, float]]
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Computes key- and tempo-invariant sequences:
        Δp_i = clip(p_i - p_{i-1}, -12.0, 12.0)
        IOI_i = t_i_on - t_{i-1}_on
        r_i = clip(log2(IOI_i / IOI_{i-1}), -3.0, 3.0)
        """
        N = len(note_events)
        if N < 2:
            return np.array([], dtype=np.float32), np.array([], dtype=np.float32)

        pitches = np.array([e[0] for e in note_events], dtype=np.float32)
        onsets = np.array([e[1] for e in note_events], dtype=np.float32)

        # Semitone deltas between adjacent notes
        dp = np.clip(np.diff(pitches), -12.0, 12.0)

        # Inter-Onset Intervals
        iois = np.diff(onsets)
        iois = np.maximum(iois, 0.05)  # min 50ms to prevent division by zero

        # Log2 IOI ratios
        if len(iois) >= 2:
            ratios = np.clip(np.log2(iois[1:] / iois[:-1]), -3.0, 3.0)
            # Pad first ratio to match dp length
            r_ioi = np.concatenate(([0.0], ratios)).astype(np.float32)
        else:
            r_ioi = np.zeros(len(dp), dtype=np.float32)

        return dp.astype(np.float32), r_ioi.astype(np.float32)

    @classmethod
    def compute_128d_coarse_embedding(cls, dp: np.ndarray, r_ioi: np.ndarray) -> np.ndarray:
        """
        Computes 128-D coarse vector via normalized 2D joint histogram of (Δp, r_ioi)
        (16 semitone bins x 8 rhythm bins = 128 dimensions), Gaussian-smoothed.
        """
        if len(dp) == 0:
            return np.zeros(128, dtype=np.float32)

        # 16 pitch bins: -12 to +12 semitones
        pitch_bins = np.linspace(-12.0, 12.0, 17)
        # 8 rhythm bins: -3.0 to +3.0 log-ratio
        rhythm_bins = np.linspace(-3.0, 3.0, 9)

        hist, _, _ = np.histogram2d(dp, r_ioi, bins=[pitch_bins, rhythm_bins])
        # Gaussian smoothing so off-key notes spill smoothly into adjacent bins
        smoothed = ndimage.gaussian_filter(hist, sigma=0.7)

        vec = smoothed.flatten().astype(np.float32)
        norm = np.linalg.norm(vec)
        if norm > 1e-6:
            vec /= norm
        return vec
