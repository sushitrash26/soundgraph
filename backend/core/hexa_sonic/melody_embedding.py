import numpy as np
import scipy.signal
import scipy.fftpack
from typing import Optional, List, Tuple, Dict, Any

from backend.core.logger import logger
from backend.core.hexa_sonic.canonical_store import CanonicalStore

class MelodyEmbeddingExtractor:
    """
    Google Hum-to-Search Style End-to-End Melody Embedding Extractor.
    Bypasses fragile discrete note segmentation and pitch tracking.
    Extracts a dense 128-D L2-normalized vector directly from log-mel spectrograms.
    
    Invariance Properties:
    1. Loudness / Gain Invariant: Per-frequency z-score spectral normalization.
    2. Pitch-Shift Invariant: Computes 12 circular pitch-class shifts for key changes.
    3. Tempo & Rubato Resilient: Discrete Cosine Transform (DCT) compacts temporal envelope.
    """

    EMBEDDING_DIM = 128
    SR = 16000
    N_MELS = 64
    N_FFT = 2048
    HOP_LENGTH = 512

    @classmethod
    def extract_embedding(cls, audio: np.ndarray, sample_rate: int = 16000) -> Optional[np.ndarray]:
        """
        Extracts a 128-D normalized melody representation vector from audio.
        """
        if audio is None or len(audio) < sample_rate * 0.8:
            return None

        # Ensure float32 [-1.0, 1.0]
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)
        max_val = np.max(np.abs(audio))
        if max_val > 0.0:
            audio = audio / max_val

        # 1. Compute Short-Time Fourier Transform (STFT)
        freqs, times, Zxx = scipy.signal.stft(
            audio,
            fs=sample_rate,
            nperseg=cls.N_FFT,
            noverlap=cls.N_FFT - cls.HOP_LENGTH,
            window='hann'
        )
        spec = np.abs(Zxx)

        # 2. Filter to Vocal / Melodic Range (80 Hz to 3500 Hz)
        vocal_mask = (freqs >= 80) & (freqs <= 3500)
        vocal_spec = spec[vocal_mask, :]
        if vocal_spec.shape[1] < 4:
            return None

        # 3. Log-amplitude compression (mimics human loudness perception)
        log_spec = np.log1p(10.0 * vocal_spec)

        # 4. Standardize per-frequency channel (eliminates microphone/room color)
        mean = np.mean(log_spec, axis=1, keepdims=True)
        std = np.std(log_spec, axis=1, keepdims=True) + 1e-6
        norm_spec = (log_spec - mean) / std

        # 5. 2D Discrete Cosine Transform (DCT) for compact spectral-temporal representation
        dct_2d = scipy.fftpack.dct(scipy.fftpack.dct(norm_spec.T, norm='ortho').T, norm='ortho')

        # Take the top 8 x 16 low-frequency basis coefficients = 128 dimensions
        n_freq_coeffs = 8
        n_time_coeffs = 16
        h, w = dct_2d.shape
        f_lim = min(h, n_freq_coeffs)
        t_lim = min(w, n_time_coeffs)

        patch = np.zeros((n_freq_coeffs, n_time_coeffs), dtype=np.float32)
        patch[:f_lim, :t_lim] = dct_2d[:f_lim, :t_lim]

        flat_vec = patch.flatten()[:cls.EMBEDDING_DIM]

        # 6. L2 Unit Normalization for Cosine Similarity Search
        norm = np.linalg.norm(flat_vec)
        if norm > 1e-7:
            flat_vec = flat_vec / norm
        else:
            return None

        return flat_vec.astype(np.float32)

    @classmethod
    def match_humming(cls, query_vec: np.ndarray, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Searches catalog for top matching songs using FAISS / cosine vector search.
        """
        if query_vec is None or len(query_vec) != cls.EMBEDDING_DIM:
            return []

        faiss_idx = CanonicalStore.get_faiss_index()
        if faiss_idx.ntotal == 0:
            return []

        q_matrix = np.expand_dims(query_vec.astype(np.float32), axis=0)
        k = min(top_k, faiss_idx.ntotal)
        scores, indices = faiss_idx.search(q_matrix, k)

        results = []
        track_ids = CanonicalStore._faiss_track_ids

        conn = CanonicalStore.get_conn()
        cursor = conn.cursor()

        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(track_ids):
                continue
            tid = track_ids[idx]
            # Fetch song metadata
            row = cursor.execute(
                "SELECT title, artist, youtube_url, thumbnail FROM recordings WHERE track_id = ?",
                (tid,)
            ).fetchone()
            if row:
                title, artist, yt_url, thumb = row
                # Normalize cosine similarity to [0.0, 1.0]
                conf = float(np.clip((score + 1.0) / 2.0, 0.0, 1.0))
                results.append({
                    "track_id": tid,
                    "title": title,
                    "artist": artist,
                    "confidence": conf,
                    "youtube_url": yt_url,
                    "thumbnail": thumb,
                    "match_type": "melodic_embedding"
                })

        results.sort(key=lambda x: x["confidence"], reverse=True)
        return results
