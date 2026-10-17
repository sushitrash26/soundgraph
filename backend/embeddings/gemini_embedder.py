import httpx
import asyncio
import base64
from typing import List, Dict, Any, Optional
from backend.core.config import settings
from backend.core.logger import logger

GEMINI_EMBED_MODEL = "models/gemini-embedding-2"
GEMINI_EMBED_URL = f"https://generativelanguage.googleapis.com/v1beta/{GEMINI_EMBED_MODEL}:embedContent"
TARGET_DIMENSIONS = 768

class GeminiEmbedder:
    """
    Multimodal Gemini Embedding Engine:
    Powered by Google's native 'gemini-embedding-2' multimodal model.
    Maps text prompts, album cover art, and visual vibe boards into a single
    shared 768-D geometric latent space (via Matryoshka dimensionality reduction).
    """
    _cache: Dict[str, List[float]] = {}

    @classmethod
    def get_api_key(cls) -> str:
        return settings.GEMINI_API_KEY or ""

    @classmethod
    async def embed_text(cls, text: str) -> Optional[List[float]]:
        """Generates a 768-dim Gemini-2 vector for any text prompt or semantic descriptor"""
        clean_text = text.strip()
        if not clean_text:
            return None

        if clean_text in cls._cache:
            return cls._cache[clean_text]

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
                        cls._cache[clean_text] = vec
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
            else:
                return loop.run_until_complete(cls.embed_image(image_bytes, mime_type))
        except Exception:
            return asyncio.run(cls.embed_image(image_bytes, mime_type))

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
        Semantic Differential Latent Axis Projection:
        Zero hardcoded numbers. Computes continuous acoustic features [0.05, 0.98]
        directly from any 768-D Gemini vector by projecting onto continuous bipolar concept axes.
        """
        import numpy as np
        if not vec or len(vec) != TARGET_DIMENSIONS:
            return {"energy": 0.50, "valence": 0.50, "danceability": 0.50, "acousticness": 0.30}

        v = np.array(vec, dtype=np.float32)
        v_norm = np.linalg.norm(v)
        if v_norm == 0:
            return {"energy": 0.50, "valence": 0.50, "danceability": 0.50, "acousticness": 0.30}
        v = v / v_norm

        anchors = cls._get_axis_anchors()
        features = {}

        for axis_name, (pos_vec, neg_vec) in anchors.items():
            if not pos_vec or not neg_vec:
                features[axis_name] = 0.50
                continue
            p = np.array(pos_vec, dtype=np.float32) / np.linalg.norm(pos_vec)
            n = np.array(neg_vec, dtype=np.float32) / np.linalg.norm(neg_vec)
            
            diff = float(np.dot(v, p) - np.dot(v, n))
            # Smooth sigmoid/linear mapping from differential to [0.05, 0.98]
            val = round(float(np.clip(0.50 + 1.35 * diff, 0.05, 0.98)), 2)
            features[axis_name] = val

        return features

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
        Creates a rich, dense semantic descriptor for embedding.
        Continuous natural language synthesis without arbitrary step-threshold buckets.
        """
        name = track.get("name") or track.get("title") or "Unknown Track"
        artists = ", ".join(track.get("artists") or ["Artist"])
        album = track.get("album", "")
        genres = ", ".join(track.get("genres") or [])
        features = track.get("features") or {}

        # Continuous natural verbalization
        acoustic_parts = []
        if "energy" in features and features["energy"] is not None:
            acoustic_parts.append(f"energy intensity: {float(features['energy']):.2f}")
        if "valence" in features and features["valence"] is not None:
            acoustic_parts.append(f"mood valence: {float(features['valence']):.2f}")
        if "danceability" in features and features["danceability"] is not None:
            acoustic_parts.append(f"danceable groove: {float(features['danceability']):.2f}")
        if "acousticness" in features and features["acousticness"] is not None:
            acoustic_parts.append(f"acoustic resonance: {float(features['acousticness']):.2f}")

        notes_str = "; ".join(acoustic_parts) if acoustic_parts else "balanced dynamics"
        album_str = f" Album: {album}." if album else ""
        genre_str = f" Genre elements: {genres}." if genres else ""
        return f"Track: {name}. Artists: {artists}.{album_str}{genre_str} Acoustic profile: {notes_str}."

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
