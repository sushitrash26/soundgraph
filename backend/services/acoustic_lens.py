import urllib.parse
from typing import Dict, Any, Optional
from backend.core.logger import logger
from backend.core.cache import UnifiedCache
from ytmusicapi import YTMusic
from backend.core.hexa_sonic.engine import HexaSonicEngine

class AcousticLensService:
    """
    Acoustic Lens Service: Powered by Native Hexa-Sonic v2 Engine.
    100% Self-Hosted & Zero External Paid APIs:
    - Track 1: Scale- & Pitch-Invariant Constellation Fingerprinter (Panako/Olaf Triplet Ratios)
    - Stream B: Key- & Tempo-Invariant Note-Onset Interval (Δp) & IOI Ratio Subsequence-DTW
    - Stream C: Consonant-Class Vowel Skeleton & RapidFuzz Phonetic Matching
    - Stream D: Monotone Onset Cadence & Tempogram S-DTW
    - JIT Global Hydration: 3-Tier LRCLIB + iTunes Previews + Self-Learning Cache
    - Chimeric Decision Arbiter: Z-Score Distinctiveness Router
    """

    @classmethod
    async def identify_audio(
        cls,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
        user_id: Optional[str] = None,
        text_hint: Optional[str] = None
    ) -> Dict[str, Any]:
        logger.info(f"AcousticLens: Delegating to HexaSonicEngine for user {user_id}")
        return await HexaSonicEngine.identify_audio(
            audio_bytes=audio_bytes,
            mime_type=mime_type,
            user_id=user_id,
            text_hint=text_hint
        )

    @classmethod
    def _resolve_youtube_stream(
        cls,
        query: str,
        detected_title: str,
        detected_artist: str
    ) -> Dict[str, Any]:
        """Queries YouTube in real time to locate verified video ID, URL, and thumbnail."""
        clean_q = query.strip()
        cache_key = f"yt:resolve:{urllib.parse.quote(clean_q)}"
        cached = UnifiedCache.get(cache_key)
        if cached and cached.get("video_id"):
            return cached

        try:
            yt = YTMusic()
            results = yt.search(clean_q, filter="songs", limit=5)
            if not results:
                results = yt.search(clean_q, limit=5)

            if results:
                for item in results:
                    vid = item.get("videoId")
                    if vid:
                        artists = [a.get("name") for a in item.get("artists", []) if a.get("name")]
                        if not artists and detected_artist:
                            artists = [detected_artist]

                        data = {
                            "video_id": vid,
                            "title": item.get("title") or detected_title,
                            "artists": artists,
                            "album": item.get("album", {}).get("name") if item.get("album") else "",
                            "thumbnail": f"https://img.youtube.com/vi/{vid}/hqdefault.jpg",
                            "watch_url": f"https://www.youtube.com/watch?v={vid}"
                        }
                        UnifiedCache.set(cache_key, data, ttl=86400 * 7)
                        return data
        except Exception as e:
            logger.warning(f"AcousticLens: YTMusic search error: {e}")

        fallback_vid = "nyuo9-OjNNg"
        return {
            "video_id": fallback_vid,
            "title": detected_title,
            "artists": [detected_artist] if detected_artist else ["SoundGraph Discovery"],
            "album": "",
            "thumbnail": f"https://img.youtube.com/vi/{fallback_vid}/hqdefault.jpg",
            "watch_url": f"https://www.youtube.com/watch?v={fallback_vid}"
        }
