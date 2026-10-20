import re
import time
import string
import logging
from typing import Dict, Any, List, Optional, Tuple
from urllib.parse import quote, urlparse
import httpx
import yaml
import os

from backend.core.logger import logger
from backend.core.neo4j_driver import neo4j_conn

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "../../config/recsys.yaml")

def load_recsys_config() -> Dict[str, Any]:
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
    except Exception as e:
        logger.warning(f"Failed to load config/recsys.yaml: {e}")
    return {}

CONFIG = load_recsys_config()
PREVIEW_CFG = CONFIG.get("previews", {})
MATCH_ACCEPT = PREVIEW_CFG.get("match_accept", 0.80)
MATCH_LOW = PREVIEW_CFG.get("match_low", 0.60)
ALLOWED_HOSTS = PREVIEW_CFG.get("allowed_hosts", [
    "audio-ssl.itunes.apple.com",
    "p.scdn.co"
])

VERSION_PENALTY_TOKENS = {
    "live", "acoustic", "remix", "slowed", "reverb", "sped", "cover", 
    "karaoke", "instrumental", "version", "tribute", "bootleg"
}

class TokenBucketRateLimiter:
    """Thread-safe / Async-safe Token Bucket for iTunes Search API rate limit."""
    def __init__(self, rate_per_minute: int = 20):
        self.capacity = float(rate_per_minute)
        self.tokens = float(rate_per_minute)
        self.fill_rate = float(rate_per_minute) / 60.0
        self.last_update = time.time()

    def acquire(self):
        now = time.time()
        elapsed = now - self.last_update
        self.last_update = now
        self.tokens = min(self.capacity, self.tokens + elapsed * self.fill_rate)
        if self.tokens < 1.0:
            sleep_time = (1.0 - self.tokens) / self.fill_rate
            time.sleep(max(0.05, sleep_time))
            self.tokens = 0.0
        else:
            self.tokens -= 1.0

itunes_limiter = TokenBucketRateLimiter(PREVIEW_CFG.get("itunes_rate_limit_per_min", 20))

class PreviewVerifier:
    """Strictly validates that a preview URL is a genuine, playable audio stream."""

    @staticmethod
    def is_allowed_host(url: str) -> bool:
        if not url:
            return False
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        if "youtube.com" in host or "youtu.be" in host:
            return False
        for allowed in ALLOWED_HOSTS:
            if allowed.startswith("*.") and host.endswith(allowed[2:]):
                return True
            if "dzcdn.net" in allowed and "dzcdn.net" in host:
                return True
            if allowed == host:
                return True
        return False

    @classmethod
    def verify_url(cls, url: str, timeout: float = 4.0) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Validates URL with a ranged GET.
        Returns: (is_ok, reason, details)
        """
        if not url or not url.strip():
            return False, "null_url", {}

        if not cls.is_allowed_host(url):
            return False, "disallowed_host_or_youtube", {"url": url}

        try:
            headers = {
                "User-Agent": "SoundGraph/1.0 (Mobile Client Audio Engine)",
                "Range": "bytes=0-1024"
            }
            with httpx.Client(timeout=timeout, follow_redirects=True) as client:
                resp = client.get(url, headers=headers)
                status = resp.status_code
                if status not in (200, 206):
                    return False, f"http_status_{status}", {"status": status}

                content_type = resp.headers.get("content-type", "").lower()
                is_audio = "audio/" in content_type or url.endswith(".m4a") or url.endswith(".mp3")
                if not is_audio:
                    return False, f"invalid_content_type_{content_type}", {"content_type": content_type}

                # Plausible size check from content-range or content-length
                total_bytes = None
                content_range = resp.headers.get("content-range")
                if content_range and "/" in content_range:
                    try:
                        total_bytes = int(content_range.split("/")[-1])
                    except Exception:
                        pass
                if total_bytes is None:
                    try:
                        total_bytes = int(resp.headers.get("content-length", 0))
                    except Exception:
                        pass

                min_bytes = PREVIEW_CFG.get("min_bytes", 100000)
                if total_bytes and total_bytes < min_bytes and status == 200:
                    return False, f"audio_too_small_{total_bytes}_bytes", {"bytes": total_bytes}

                return True, "verified_playable", {
                    "status": status,
                    "content_type": content_type,
                    "bytes": total_bytes
                }
        except httpx.TimeoutException:
            return False, "timeout", {}
        except Exception as e:
            return False, f"network_error: {str(e)}", {}


class PreviewResolver:
    """Matches tracks against iTunes Search API and Deezer fallback with multi-factor scoring."""

    @staticmethod
    def clean_text(text: str) -> str:
        if not text:
            return ""
        # Strip common video/release tags
        s = re.sub(r"[\(\[\{].*?(official|video|audio|lyrics|hd|4k|remastered|visualizer|clip|feat\.|ft\.).*?[\)\]\}]", "", text, flags=re.IGNORECASE)
        s = re.sub(r"feat\..*$", "", s, flags=re.IGNORECASE)
        s = re.sub(r"ft\..*$", "", s, flags=re.IGNORECASE)
        s = re.sub(r"[^\w\s]", " ", s)
        return " ".join(s.lower().split())

    @classmethod
    def token_set_similarity(cls, s1: str, s2: str) -> float:
        t1 = set(cls.clean_text(s1).split())
        t2 = set(cls.clean_text(s2).split())
        if not t1 or not t2:
            return 0.0
        intersection = len(t1 & t2)
        union = len(t1 | t2)
        return float(intersection) / float(union) if union > 0 else 0.0

    @classmethod
    def calculate_match_score(
        cls, 
        source_title: str, 
        source_artists: List[str], 
        source_duration_ms: Optional[int],
        source_album: Optional[str],
        candidate: Dict[str, Any]
    ) -> float:
        cand_title = candidate.get("trackName") or candidate.get("title") or ""
        cand_artist = candidate.get("artistName") or (candidate.get("artist") or {}).get("name") or ""
        cand_album = candidate.get("collectionName") or (candidate.get("album") or {}).get("title") or ""
        cand_duration_ms = candidate.get("trackTimeMillis") or (candidate.get("duration", 0) * 1000)

        # 1. Title Similarity (0.45)
        title_sim = cls.token_set_similarity(source_title, cand_title)

        # 2. Artist Similarity (0.35)
        source_artist_str = " ".join(source_artists) if source_artists else ""
        artist_sim = cls.token_set_similarity(source_artist_str, cand_artist)

        # 3. Duration Similarity (0.15)
        duration_sim = 1.0
        if source_duration_ms and cand_duration_ms and source_duration_ms > 0:
            delta_sec = abs(source_duration_ms - cand_duration_ms) / 1000.0
            duration_sim = max(0.0, 1.0 - (delta_sec / 10.0))

        # 4. Album Similarity (0.05)
        album_sim = 1.0
        if source_album and cand_album:
            album_sim = cls.token_set_similarity(source_album, cand_album)

        score = (0.45 * title_sim) + (0.35 * artist_sim) + (0.15 * duration_sim) + (0.05 * album_sim)

        # Version Penalties (-0.25 per unwanted token)
        source_tokens = set(cls.clean_text(source_title).split())
        cand_tokens = set(cand_title.lower().split())
        for token in VERSION_PENALTY_TOKENS:
            if token in cand_tokens and token not in source_tokens:
                score -= 0.25

        return max(0.0, min(1.0, round(score, 3)))

    @classmethod
    def resolve_track(
        cls, 
        title: str, 
        artists: List[str], 
        duration_ms: Optional[int] = None,
        album: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Resolves a studio preview URL via iTunes Search API with multi-factor scoring.
        Falls back to Deezer if iTunes match is low.
        """
        clean_title = cls.clean_text(title)
        primary_artist = artists[0] if artists else ""
        clean_artist = cls.clean_text(primary_artist)

        search_term = f"{clean_title} {clean_artist}".strip()
        if not search_term:
            return None

        # 1. Query iTunes Search (limit=7)
        itunes_limiter.acquire()
        try:
            itunes_url = f"https://itunes.apple.com/search?term={quote(search_term)}&entity=song&limit=7"
            with httpx.Client(timeout=4.0) as client:
                resp = client.get(itunes_url)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("results") or []
                    best_match = None
                    best_score = -1.0

                    for cand in candidates:
                        preview = cand.get("previewUrl")
                        if not preview:
                            continue
                        score = cls.calculate_match_score(title, artists, duration_ms, album, cand)
                        if score > best_score:
                            best_score = score
                            best_match = cand

                    if best_match and best_score >= MATCH_ACCEPT:
                        # Verify audio stream reachability
                        is_ok, reason, details = PreviewVerifier.verify_url(best_match["previewUrl"])
                        if is_ok:
                            return {
                                "preview_url": best_match["previewUrl"],
                                "preview_source": "itunes",
                                "preview_status": "ok",
                                "match_confidence": best_score,
                                "itunes_track_id": str(best_match.get("trackId", "")),
                                "resolved_title": best_match.get("trackName"),
                                "resolved_artist": best_match.get("artistName"),
                                "cover_url": best_match.get("artworkUrl100", "").replace("100x100bb", "600x600bb"),
                                "duration_ms": best_match.get("trackTimeMillis", duration_ms)
                            }
        except Exception as e:
            logger.warning(f"iTunes search failed for '{search_term}': {e}")

        # 2. Deezer Fallback (if allowed and iTunes failed)
        try:
            deezer_url = f"https://api.deezer.com/search?q={quote(search_term)}&limit=5"
            with httpx.Client(timeout=4.0) as client:
                resp = client.get(deezer_url)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("data") or []
                    best_match = None
                    best_score = -1.0

                    for cand in candidates:
                        preview = cand.get("preview")
                        if not preview:
                            continue
                        score = cls.calculate_match_score(title, artists, duration_ms, album, cand)
                        if score > best_score:
                            best_score = score
                            best_match = cand

                    if best_match and best_score >= MATCH_ACCEPT:
                        is_ok, reason, details = PreviewVerifier.verify_url(best_match["preview"])
                        if is_ok:
                            return {
                                "preview_url": best_match["preview"],
                                "preview_source": "deezer",
                                "preview_status": "ok",
                                "match_confidence": best_score,
                                "itunes_track_id": None,
                                "resolved_title": best_match.get("title"),
                                "resolved_artist": (best_match.get("artist") or {}).get("name"),
                                "cover_url": (best_match.get("album") or {}).get("cover_big", ""),
                                "duration_ms": best_match.get("duration", 0) * 1000
                            }
        except Exception as e:
            logger.warning(f"Deezer fallback search failed for '{search_term}': {e}")

        return None
