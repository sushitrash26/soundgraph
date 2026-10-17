import httpx
import asyncio
from typing import List, Dict, Any, Optional
from backend.core.config import settings
from backend.core.logger import logger

GEMINI_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"
TARGET_DIMENSIONS = 768

class GeminiEmbedder:
    _cache: Dict[str, List[float]] = {}

    @classmethod
    def get_api_key(cls) -> str:
        return settings.GEMINI_API_KEY or ""

    @classmethod
    async def embed_text(cls, text: str) -> Optional[List[float]]:
        """Generates a 768-dim Gemini vector for any text or prompt"""
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
            "model": "models/gemini-embedding-001",
            "content": {
                "parts": [{"text": clean_text[:1000]}]
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
                    logger.warning(f"Gemini embed API returned status {res.status_code}: {res.text[:200]}")
        except Exception as e:
            logger.error(f"Error calling Gemini embed API: {e}")

        return None

    @classmethod
    def embed_text_sync(cls, text: str) -> Optional[List[float]]:
        """Synchronous wrapper for embed_text"""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # In running loop, run in executor
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(asyncio.run, cls.embed_text(text)).result()
            else:
                return loop.run_until_complete(cls.embed_text(text))
        except Exception:
            return asyncio.run(cls.embed_text(text))

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
        """Batch generates embeddings for multiple tracks"""
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

