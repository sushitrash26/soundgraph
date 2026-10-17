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

    @classmethod
    def build_track_semantic_description(cls, track: Dict[str, Any]) -> str:
        """
        Creates a rich, dense semantic descriptor for embedding.
        Synthesizes title, artists, album, genres, source, and acoustic properties.
        """
        name = track.get("name") or track.get("title") or "Unknown Track"
        artists = ", ".join(track.get("artists") or ["Artist"])
        album = track.get("album", "")
        genres = ", ".join(track.get("genres") or [])
        features = track.get("features") or {}

        acoustic_notes = []
        if features.get("energy", 0) > 0.7:
            acoustic_notes.append("high energy, driving pulse")
        elif features.get("energy", 0) < 0.4:
            acoustic_notes.append("mellow, calm acoustic resonance")

        if features.get("danceability", 0) > 0.7:
            acoustic_notes.append("danceable rhythmic groove")

        if features.get("valence", 0) > 0.6:
            acoustic_notes.append("euphoric, upbeat mood")
        elif features.get("valence", 0) < 0.4:
            acoustic_notes.append("melancholic, moody atmosphere")

        notes_str = "; ".join(acoustic_notes)
        return f"Track: {name}. Artists: {artists}. Album: {album}. Genre elements: {genres}. Acoustic characteristics: {notes_str}."

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
