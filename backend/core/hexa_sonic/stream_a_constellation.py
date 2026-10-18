import math
import numpy as np
from scipy import signal, ndimage
from typing import List, Tuple, Dict, Any, Optional

class StreamAConstellation:
    """
    Section 4 Stream A: Scale- and Pitch-Invariant Triplet Constellation Fingerprinter.
    Implements the Panako/Olaf Triplet Ratio method.
    Invariant to:
    - Pitch shifts (+/- 2-4 semitones)
    - Playback speed changes (nightcore / slowed 0.85x - 1.25x)
    - Room reverberation & speaker frequency coloration
    """

    N_FFT = 2048
    HOP_LENGTH = 512
    SR = 16000

    PEAK_NEIGHBORHOOD = (15, 15)  # (frames, frequency bins)
    LOOKAHEAD_SECONDS = 2.0
    MIN_DELTA_TIME = 0.05
    COLLINEAR_THRESHOLD = 35  # Min aligned hashes for true master audio (real masters have 200-50,000)

    @classmethod
    def extract_peaks(cls, audio_bus1: np.ndarray) -> List[Tuple[float, float]]:
        """
        Computes STFT and finds local 2D spectrogram energy peaks (t_sec, f_hz).
        """
        if len(audio_bus1) < cls.N_FFT:
            return []

        f, t, Zxx = signal.stft(
            audio_bus1,
            fs=cls.SR,
            nperseg=cls.N_FFT,
            noverlap=cls.N_FFT - cls.HOP_LENGTH,
            window="hann"
        )
        magnitude = np.abs(Zxx)

        # 2D local maximum filter
        local_max = ndimage.maximum_filter(magnitude, size=cls.PEAK_NEIGHBORHOOD) == magnitude

        # Dynamic amplitude threshold: top 15% energy peaks
        amp_threshold = np.percentile(magnitude, 85)
        detected = (magnitude > amp_threshold) & local_max

        peak_freq_idx, peak_time_idx = np.where(detected)
        peaks = []
        for fi, ti in zip(peak_freq_idx, peak_time_idx):
            freq = f[fi]
            # Focus on fundamental and mid harmonic bands (120 Hz to 5000 Hz)
            if 120.0 <= freq <= 5000.0:
                peaks.append((float(t[ti]), float(freq)))

        # Sort by time
        peaks.sort(key=lambda p: p[0])
        return peaks

    @classmethod
    def generate_triplet_hashes(cls, peaks: List[Tuple[float, float]]) -> List[Tuple[int, float]]:
        """
        Packs anchor-target peak triplets A(t1, f1), B(t2, f2), C(t3, f3)
        into 32-bit scale-invariant hashes:
        Δc_12 = round(1200 * log2(f2 / f1) / 25)
        Δc_23 = round(1200 * log2(f3 / f2) / 25)
        R_t = round(((t3 - t2) / (t2 - t1)) * 16)
        Hash = (Δc_12 << 20) | (Δc_23 << 8) | (R_t & 0xFF)
        Returns: [(hash_32bit, t1_anchor_timestamp_sec), ...]
        """
        hashes = []
        n_peaks = len(peaks)
        if n_peaks < 3:
            return hashes

        for i in range(n_peaks - 2):
            t1, f1 = peaks[i]
            if f1 <= 1e-4:
                continue

            for j in range(i + 1, min(i + 12, n_peaks - 1)):
                t2, f2 = peaks[j]
                dt12 = t2 - t1
                if dt12 < cls.MIN_DELTA_TIME or dt12 > cls.LOOKAHEAD_SECONDS:
                    continue
                if f2 <= 1e-4:
                    continue

                for k in range(j + 1, min(j + 8, n_peaks)):
                    t3, f3 = peaks[k]
                    dt23 = t3 - t2
                    if dt23 < cls.MIN_DELTA_TIME or (t3 - t1) > cls.LOOKAHEAD_SECONDS:
                        continue
                    if f3 <= 1e-4:
                        continue

                    # Require minimum frequency separation to avoid monotone hum degenerate hashes
                    if abs(f2 - f1) < 15.0 and abs(f3 - f2) < 15.0:
                        continue

                    # Frequency ratio in 25-cent increments (quantized log-cents)
                    try:
                        c12 = int(round((1200.0 * math.log2(f2 / f1)) / 25.0))
                        c23 = int(round((1200.0 * math.log2(f3 / f2)) / 25.0))
                        # Time ratio quantized
                        rt = int(round((dt23 / dt12) * 16.0))
                    except (ValueError, ZeroDivisionError):
                        continue

                    # Mask to signed 10-bit integers (-512 to 511)
                    c12_packed = c12 & 0x3FF
                    c23_packed = c23 & 0x3FF
                    rt_packed = rt & 0xFF

                    hash_val = (c12_packed << 20) | (c23_packed << 8) | rt_packed
                    hashes.append((hash_val, float(t1)))

        return hashes

    @classmethod
    def match_against_index(
        cls,
        query_hashes: List[Tuple[int, float]],
        catalog_index: Dict[int, List[Tuple[str, float]]]
    ) -> List[Dict[str, Any]]:
        """
        Matches query hashes against inverted index.
        catalog_index maps: hash_32bit -> [(track_id, anchor_t_sec), ...]
        Uses time-offset scatter histogram to identify collinear diagonal alignments.
        """
        if not query_hashes or not catalog_index:
            return []

        # track_id -> list of (t_catalog - t_query)
        offsets_by_track: Dict[str, List[float]] = {}

        for q_hash, q_time in query_hashes:
            matches = catalog_index.get(q_hash)
            if matches:
                for track_id, cat_time in matches:
                    delta_t = round(cat_time - q_time, 2)
                    if track_id not in offsets_by_track:
                        offsets_by_track[track_id] = []
                    offsets_by_track[track_id].append(delta_t)

        results = []
        for track_id, deltas in offsets_by_track.items():
            if len(deltas) < 3:
                continue

            # Histogram binning (0.1s resolution) to find collinear cluster
            # Sped-up/slowed tracks might have slight drift, so bin in 0.25s
            bins: Dict[float, int] = {}
            for d in deltas:
                b = round(d * 4.0) / 4.0
                bins[b] = bins.get(b, 0) + 1

            best_offset, max_collinear = max(bins.items(), key=lambda x: x[1])
            total_matches = len(deltas)

            # Score: collinear density normalized
            score = min(1.0, max_collinear / 20.0)

            results.append({
                "track_id": track_id,
                "score": float(score),
                "collinear_count": int(max_collinear),
                "total_matches": int(total_matches),
                "offset_sec": float(best_offset)
            })

        results.sort(key=lambda r: r["collinear_count"], reverse=True)
        return results
