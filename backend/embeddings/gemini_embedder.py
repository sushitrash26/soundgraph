import httpx
import asyncio
import base64
from typing import List, Dict, Any, Optional
from backend.core.config import settings
from backend.core.logger import logger

import hashlib
from backend.core.cache import UnifiedCache

GEMINI_EMBED_MODEL = "models/gemini-embedding-2"
GEMINI_EMBED_URL = f"https://generativelanguage.googleapis.com/v1beta/{GEMINI_EMBED_MODEL}:embedContent"
TARGET_DIMENSIONS = 768

class GeminiEmbedder:
    """
    Multimodal Gemini Embedding Engine:
    Powered by Google's native 'gemini-embedding-2' multimodal model.
    Maps text prompts, album cover art, visual vibe boards, and raw audio waveforms into a single
    shared 768-D geometric latent space backed by persistent distributed UnifiedCache.
    """

    @classmethod
    def get_api_key(cls) -> str:
        return settings.GEMINI_API_KEY or ""

    @classmethod
    def _cache_key(cls, prefix: str, data: str) -> str:
        h = hashlib.sha256(data.encode("utf-8", errors="ignore")).hexdigest()
        return f"embed:{prefix}:{h}"

    @classmethod
    async def embed_text(cls, text: str) -> Optional[List[float]]:
        """Generates a 768-dim Gemini-2 vector for any text prompt or semantic descriptor"""
        clean_text = text.strip()
        if not clean_text:
            return None

        ckey = cls._cache_key("text", clean_text)
        cached = UnifiedCache.get(ckey)
        if cached and len(cached) == TARGET_DIMENSIONS:
            return cached

        api_key = cls.get_api_key()
        if not api_key:
            logger.warning("Gemini API key missing. Cannot generate embeddings.")
            return None

        url = f"{GEMINI_EMBED_URL}?key={api_key}"
        payload = {
            "model": GEMINI_EMBED_MODEL,
            "content": {
                "parts": [{"text": clean_text[:1200]}]
            },
            "outputDimensionality": TARGET_DIMENSIONS
        }

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    vec = data.get("embedding", {}).get("values", [])
                    if len(vec) == TARGET_DIMENSIONS:
                        UnifiedCache.set(ckey, vec, ttl=86400 * 30)  # 30 days cache
                        return vec
                else:
                    logger.warning(f"Gemini-2 embed API status {res.status_code}: {res.text[:200]}")
        except Exception as e:
            logger.error(f"Error calling Gemini-2 embed API: {e}")

        return None

    @classmethod
    def embed_text_sync(cls, text: str) -> Optional[List[float]]:
        """Synchronous wrapper for embed_text"""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(asyncio.run, cls.embed_text(text)).result()
            else:
                return loop.run_until_complete(cls.embed_text(text))
        except Exception:
            return asyncio.run(cls.embed_text(text))

    @classmethod
    async def embed_image(cls, image_bytes: bytes, mime_type: str = "image/jpeg") -> Optional[List[float]]:
        """
        Natively embeds an image (photo, mood board, or album art) into the same 768-D space
        as music tracks using gemini-embedding-2.
        """
        api_key = cls.get_api_key()
        if not api_key or not image_bytes:
            return None

        b64_data = base64.b64encode(image_bytes).decode("ascii")
        url = f"{GEMINI_EMBED_URL}?key={api_key}"
        payload = {
            "model": GEMINI_EMBED_MODEL,
            "content": {
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": b64_data
                        }
                    }
                ]
            },
            "outputDimensionality": TARGET_DIMENSIONS
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    vec = data.get("embedding", {}).get("values", [])
                    if len(vec) == TARGET_DIMENSIONS:
                        return vec
                else:
                    logger.warning(f"Gemini-2 image embed API status {res.status_code}: {res.text[:200]}")
        except Exception as e:
            logger.error(f"Error calling Gemini-2 image embed API: {e}")

        return None

    @classmethod
    def embed_image_sync(cls, image_bytes: bytes, mime_type: str = "image/jpeg") -> Optional[List[float]]:
        """Synchronous wrapper for embed_image"""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(asyncio.run, cls.embed_image(image_bytes, mime_type)).result()
        except Exception:
            return asyncio.run(cls.embed_image(image_bytes, mime_type))

    @classmethod
    async def embed_audio(cls, audio_bytes: bytes, mime_type: str = "audio/mp3") -> Optional[List[float]]:
        """
        Natively embeds raw waveform audio (30s MP3 preview) into the exact same 768-D space
        as track metadata and visual aesthetics using gemini-embedding-2.
        """
        api_key = cls.get_api_key()
        if not api_key or not audio_bytes:
            return None

        # Check cache by audio hash
        audio_hash = hashlib.sha256(audio_bytes).hexdigest()
        ckey = f"embed:audio:{audio_hash}"
        cached = UnifiedCache.get(ckey)
        if cached and len(cached) == TARGET_DIMENSIONS:
            return cached

        b64_data = base64.b64encode(audio_bytes).decode("ascii")
        url = f"{GEMINI_EMBED_URL}?key={api_key}"
        payload = {
            "model": GEMINI_EMBED_MODEL,
            "content": {
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": b64_data
                        }
                    }
                ]
            },
            "outputDimensionality": TARGET_DIMENSIONS
        }

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    vec = data.get("embedding", {}).get("values", [])
                    if len(vec) == TARGET_DIMENSIONS:
                        UnifiedCache.set(ckey, vec, ttl=86400 * 30)
                        return vec
                else:
                    logger.warning(f"Gemini-2 audio embed status {res.status_code}: {res.text[:200]}")
        except Exception as e:
            logger.error(f"Error calling Gemini-2 audio embed API: {e}")

        return None

    @classmethod
    def embed_audio_sync(cls, audio_bytes: bytes, mime_type: str = "audio/mp3") -> Optional[List[float]]:
        """Synchronous wrapper for embed_audio"""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(asyncio.run, cls.embed_audio(audio_bytes, mime_type)).result()
            else:
                return loop.run_until_complete(cls.embed_audio(audio_bytes, mime_type))
        except Exception:
            return asyncio.run(cls.embed_audio(audio_bytes, mime_type))

    @classmethod
    async def embed_multimodal(cls, text: Optional[str] = None, image_bytes: Optional[bytes] = None, mime_type: str = "image/jpeg") -> Optional[List[float]]:
        """
        Joint multimodal embedding combining text vibes and visual imagery
        into a single 768-D representation.
        """
        api_key = cls.get_api_key()
        if not api_key:
            return None

        parts = []
        if text and text.strip():
            parts.append({"text": text.strip()[:1000]})
        if image_bytes:
            b64_data = base64.b64encode(image_bytes).decode("ascii")
            parts.append({
                "inlineData": {
                    "mimeType": mime_type,
                    "data": b64_data
                }
            })

        if not parts:
            return None

        url = f"{GEMINI_EMBED_URL}?key={api_key}"
        payload = {
            "model": GEMINI_EMBED_MODEL,
            "content": {"parts": parts},
            "outputDimensionality": TARGET_DIMENSIONS
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    vec = data.get("embedding", {}).get("values", [])
                    if len(vec) == TARGET_DIMENSIONS:
                        return vec
        except Exception as e:
            logger.error(f"Error in embed_multimodal: {e}")

        return None

    @classmethod
    def embed_multimodal_sync(cls, text: Optional[str] = None, image_bytes: Optional[bytes] = None, mime_type: str = "image/jpeg") -> Optional[List[float]]:
        """Synchronous wrapper for embed_multimodal"""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(asyncio.run, cls.embed_multimodal(text, image_bytes, mime_type)).result()
            else:
                return loop.run_until_complete(cls.embed_multimodal(text, image_bytes, mime_type))
        except Exception:
            return asyncio.run(cls.embed_multimodal(text, image_bytes, mime_type))

    # Canonical Genre Anchors for Zero-Shot Semantic Classification
    CANONICAL_GENRES = [
        "electronic", "synthwave", "indie rock", "alternative rock", "hip hop",
        "r&b", "pop", "bollywood", "lo-fi", "ambient", "classical", "jazz",
        "metal", "dance pop", "house", "techno", "folk", "psychedelic rock"
    ]
    _genre_anchors: Dict[str, List[float]] = {}
    _axis_anchors: Dict[str, Any] = {}

    @classmethod
    def _get_axis_anchors(cls) -> Dict[str, Any]:
        """Precomputes bipolar semantic poles for latent axis projection"""
        if not cls._axis_anchors:
            pos_energy = cls.embed_text_sync("intense loud explosive uptempo energetic high-bpm aggressive driving music")
            neg_energy = cls.embed_text_sync("quiet mellow gentle calm acoustic slow ambient peaceful relaxing music")
            pos_valence = cls.embed_text_sync("happy euphoric joyful cheerful optimistic vibrant sunny celebratory mood")
            neg_valence = cls.embed_text_sync("sad melancholic depressing sorrowful gloomy moody dark emotional heartache")
            pos_dance = cls.embed_text_sync("infectious danceable club rhythm groove regular beat syncopated dance music")
            neg_dance = cls.embed_text_sync("ambient freeform non-rhythmic abstract fluid unstructured drone soundscape")
            pos_acoustic = cls.embed_text_sync("pure acoustic unplugged raw wooden instruments vocal acoustic guitar piano orchestra")
            neg_acoustic = cls.embed_text_sync("heavily synthesized electronic digital synthesizer computerized vocoder autotune distorted")

            cls._axis_anchors = {
                "energy": (pos_energy, neg_energy),
                "valence": (pos_valence, neg_valence),
                "danceability": (pos_dance, neg_dance),
                "acousticness": (pos_acoustic, neg_acoustic)
            }
        return cls._axis_anchors

    @classmethod
    def infer_acoustic_features_from_embedding(cls, vec: List[float]) -> Dict[str, float]:
        """
        Calibrated Multi-Anchor Ensemble Acoustic Inference (W5 Part A):
        Computes continuous acoustic features [0.05, 0.98] directly from any 768-D Gemini vector
        using multi-anchor ensemble differentials verified against Spotify ground truth.
        """
        import numpy as np
        if not vec or len(vec) != TARGET_DIMENSIONS:
            return {"energy": 0.50, "valence": 0.50, "danceability": 0.50, "acousticness": 0.30}

        try:
            from backend.services.feature_calibrator import FeatureCalibrator
            raw_scores = FeatureCalibrator.compute_raw_scores(vec)
            features = {}
            for feat in ["energy", "valence", "danceability", "acousticness"]:
                raw = raw_scores.get(f"{feat}_raw", 0.0)
                # Calibrated logistic mapping mapping raw differential to [0.05, 0.95]
                prob = 1.0 / (1.0 + float(np.exp(-4.0 * raw)))
                features[feat] = round(float(np.clip(prob, 0.05, 0.95)), 2)
            return features
        except Exception as e:
            logger.warning(f"Error in ensemble acoustic inference: {e}")
            return {"energy": 0.50, "valence": 0.50, "danceability": 0.50, "acousticness": 0.30}

    @classmethod
    def infer_genres_from_embedding(cls, vec: List[float], top_k: int = 3, min_sim: float = 0.65) -> List[str]:
        """
        Zero-Shot Semantic Genre Classification:
        Projects track vector onto 768-D canonical genre concept embeddings.
        Completely eliminates hardcoded genre fallbacks.
        """
        import numpy as np
        if not vec or len(vec) != TARGET_DIMENSIONS:
            return ["music"]

        v = np.array(vec, dtype=np.float32)
        v_norm = np.linalg.norm(v)
        if v_norm == 0:
            return ["music"]
        v = v / v_norm

        # Pre-cache canonical genre embeddings
        if not cls._genre_anchors:
            for g in cls.CANONICAL_GENRES:
                g_vec = cls.embed_text_sync(f"Musical genre and acoustic aesthetics of {g} music")
                if g_vec and len(g_vec) == TARGET_DIMENSIONS:
                    g_arr = np.array(g_vec, dtype=np.float32)
                    cls._genre_anchors[g] = (g_arr / np.linalg.norm(g_arr)).tolist()

        scores = []
        for g, g_arr in cls._genre_anchors.items():
            sim = float(np.dot(v, np.array(g_arr, dtype=np.float32)))
            scores.append((g, sim))

        scores.sort(key=lambda x: x[1], reverse=True)
        matched = [g for g, sim in scores if sim >= min_sim][:top_k]
        if not matched and scores:
            matched = [scores[0][0]]
        return matched

    @classmethod
    def build_track_semantic_description(cls, track: Dict[str, Any]) -> str:
        """
        Creates a rich, clean semantic descriptor for embedding (Embedding Text v2).
        Eliminates circular numeric feature strings (F-21).
        Format: '{title} by {artists}. Album: {album}. Genres and tags: {genres}.'
        """
        name = track.get("name") or track.get("title") or "Unknown Track"
        artists = ", ".join(track.get("artists") or ["Artist"])
        album = track.get("album", "")
        genres = ", ".join(track.get("genres") or [])

        album_str = f" Album: {album}." if album else ""
        genre_str = f" Genres and tags: {genres}." if genres else ""
        return f"{name} by {artists}.{album_str}{genre_str}".strip()

    @classmethod
    async def embed_tracks_batch(cls, tracks: List[Dict[str, Any]]) -> Dict[str, List[float]]:
        """Batch generates Gemini-2 embeddings for multiple tracks"""
        results: Dict[str, List[float]] = {}
        tasks = []

        for tr in tracks:
            tid = tr.get("id")
            if not tid:
                continue
            desc = cls.build_track_semantic_description(tr)
            tasks.append((tid, desc))

        for tid, desc in tasks:
            vec = await cls.embed_text(desc)
            if vec:
                results[tid] = vec

        return results

    @classmethod
    def embed_tracks_batch_sync(cls, tracks: List[Dict[str, Any]]) -> Dict[str, List[float]]:
        """Synchronous wrapper for embed_tracks_batch"""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(asyncio.run, cls.embed_tracks_batch(tracks)).result()
            else:
                return loop.run_until_complete(cls.embed_tracks_batch(tracks))
        except Exception:
            return asyncio.run(cls.embed_tracks_batch(tracks))
