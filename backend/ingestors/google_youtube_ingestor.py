import httpx
import re
import urllib.parse
from typing import List, Dict, Any, Optional
from backend.core.config import settings
from backend.core.logger import logger
from backend.ingestors.base import BaseIngestor
from backend.embeddings.gemini_embedder import GeminiEmbedder

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/youtube.readonly",
]

class GoogleYouTubeIngestor(BaseIngestor):
    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token

    @classmethod
    def get_auth_url(cls, redirect_uri: Optional[str] = None) -> str:
        target_redirect = redirect_uri or getattr(settings, "GOOGLE_REDIRECT_URI", f"http://127.0.0.1:{settings.API_PORT}/auth/google/callback")
        params = {
            "client_id": getattr(settings, "GOOGLE_CLIENT_ID", ""),
            "redirect_uri": target_redirect,
            "response_type": "code",
            "scope": " ".join(GOOGLE_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
        }
        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{GOOGLE_AUTH_URL}?{query_string}"

    @classmethod
    async def exchange_code_for_token(cls, code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
        target_redirect = redirect_uri or getattr(settings, "GOOGLE_REDIRECT_URI", f"http://127.0.0.1:{settings.API_PORT}/auth/google/callback")
        payload = {
            "client_id": getattr(settings, "GOOGLE_CLIENT_ID", ""),
            "client_secret": getattr(settings, "GOOGLE_CLIENT_SECRET", ""),
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": target_redirect,
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(GOOGLE_TOKEN_URL, data=payload)
            if res.status_code != 200:
                logger.error(f"Google token exchange failed: {res.text}")
                raise ValueError(f"Failed to exchange Google OAuth code: {res.text}")
            return res.json()

    async def fetch_user_profile(self) -> Dict[str, Any]:
        if not self.access_token:
            raise ValueError("Access token required")

        headers = {"Authorization": f"Bearer {self.access_token}"}
        async with httpx.AsyncClient() as client:
            res = await client.get(GOOGLE_USERINFO_URL, headers=headers)
            if res.status_code != 200:
                raise ValueError(f"Failed to fetch Google userinfo: {res.text}")
            data = res.json()
            return {
                "id": f"google:{data.get('id')}",
                "name": data.get("name") or data.get("email"),
                "email": data.get("email"),
                "source": "google_youtube",
                "avatar_url": data.get("picture", "")
            }

    async def fetch_listening_data(self, max_pages_lm: int = 8) -> List[Dict[str, Any]]:
        """
        Comprehensive Multi-Page YouTube Music Ingestion:
        1. Directly targets YouTube Music's dedicated Liked Music playlist ('LM') with pagination.
        2. Ingests user created playlists and custom collections with pagination.
        3. Enriches tracks with official 600x600 album artwork and 30s AAC preview streams.
        4. Derives acoustic embeddings and canonical genre tags.
        """
        if not self.access_token:
            raise ValueError("Access token required")

        tracks: Dict[str, Dict[str, Any]] = {}
        headers = {"Authorization": f"Bearer {self.access_token}"}
        raw_items: List[Dict[str, Any]] = []

        async with httpx.AsyncClient(timeout=20.0) as client:
            # 1. Fetch from YouTube Music's dedicated Liked Music playlist (ID: 'LM')
            try:
                page_token = None
                for page_num in range(max_pages_lm):
                    params = {"part": "snippet", "playlistId": "LM", "maxResults": 50}
                    if page_token:
                        params["pageToken"] = page_token
                    res = await client.get(f"{YOUTUBE_API_BASE}/playlistItems", params=params, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        page_items = data.get("items", [])
                        raw_items.extend(page_items)
                        page_token = data.get("nextPageToken")
                        if not page_token:
                            break
                    else:
                        logger.warning(f"YouTube Music LM fetch status {res.status_code}: {res.text[:120]}")
                        break
                logger.info(f"Retrieved {len(raw_items)} items from YouTube Music Liked Music (LM)")
            except Exception as e:
                logger.warning(f"Error fetching YouTube Music LM playlist: {e}")

            # 2. Fetch User's Custom Playlists (e.g. 'Fav.', etc.)
            try:
                pl_res = await client.get(
                    f"{YOUTUBE_API_BASE}/playlists",
                    params={"part": "snippet,contentDetails", "mine": "true", "maxResults": 25},
                    headers=headers
                )
                if pl_res.status_code == 200:
                    for pl in pl_res.json().get("items", []):
                        pl_id = pl.get("id")
                        pl_title = pl.get("snippet", {}).get("title", "")
                        # Skip academic or non-music playlists
                        if any(term in pl_title.lower() for term in ["physics", "math", "python", "optics", "waves", "pnc", "line"]):
                            continue

                        pl_page_token = None
                        for _ in range(3):  # up to 150 items per playlist
                            p_params = {"part": "snippet", "playlistId": pl_id, "maxResults": 50}
                            if pl_page_token:
                                p_params["pageToken"] = pl_page_token
                            items_res = await client.get(f"{YOUTUBE_API_BASE}/playlistItems", params=p_params, headers=headers)
                            if items_res.status_code == 200:
                                p_data = items_res.json()
                                raw_items.extend(p_data.get("items", []))
                                pl_page_token = p_data.get("nextPageToken")
                                if not pl_page_token:
                                    break
                            else:
                                break
            except Exception as e:
                logger.warning(f"Error fetching YouTube user playlists: {e}")

            # 3. Deduplicate by videoId
            seen_vids = set()
            unique_items = []
            for item in raw_items:
                vid = item.get("snippet", {}).get("resourceId", {}).get("videoId")
                if vid and vid not in seen_vids:
                    title = item.get("snippet", {}).get("title", "")
                    if any(bad in title.lower() for bad in ["#shorts", "private video", "deleted video", "short video"]):
                        continue
                    seen_vids.add(vid)
                    unique_items.append(item)

            logger.info(f"Processing and enriching {len(unique_items)} unique YouTube Music tracks...")

            # 4. Parse & Enrich with iTunes official artwork / AAC preview streams concurrently
            sem = asyncio.Semaphore(12)
            async def _worker(it):
                async with sem:
                    try:
                        return await self._parse_and_enrich_track(it, client)
                    except Exception as err:
                        logger.warning(f"Error enriching track {it.get('snippet', {}).get('title')}: {err}")
                        return None

            results = await asyncio.gather(*[_worker(it) for it in unique_items], return_exceptions=True)
            for res in results:
                if isinstance(res, dict) and res.get("id"):
                    tracks[res["id"]] = res

        logger.info(f"Successfully processed {len(tracks)} verified YouTube Music tracks.")
        return list(tracks.values())

    async def _parse_and_enrich_track(self, item: Dict[str, Any], client: httpx.AsyncClient) -> Optional[Dict[str, Any]]:
        snippet = item.get("snippet", {})
        vid = snippet.get("resourceId", {}).get("videoId")
        if not vid:
            return None

        raw_title = snippet.get("title", "Unknown Track")
        channel = snippet.get("videoOwnerChannelTitle") or snippet.get("channelTitle") or "Various Artists"

        # Clean noise like (Official Music Video), [Official Audio], etc.
        cleaned_title = re.sub(
            r"(\[.*?\]|\(.*?\)|official music video|official video|official audio|lyric video|lyrics|audio|4k|hd)",
            "",
            raw_title,
            flags=re.IGNORECASE
        ).strip()

        # Parse Artist - Title
        artist = channel.replace(" - Topic", "").replace("VEVO", "").strip()
        song_name = cleaned_title or raw_title
        if " - " in cleaned_title:
            parts = cleaned_title.split(" - ", 1)
            artist = parts[0].strip()
            song_name = parts[1].strip()

        cover_url = f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"
        preview_url = f"https://www.youtube.com/watch?v={vid}"

        # Enrich via iTunes Search API for official 600x600 cover and 30s AAC preview stream
        try:
            q = urllib.parse.quote(f"{song_name} {artist}".strip())
            itunes_url = f"https://itunes.apple.com/search?term={q}&entity=song&limit=1"
            i_res = await client.get(itunes_url, timeout=3.5)
            if i_res.status_code == 200:
                i_data = i_res.json()
                if i_data.get("resultCount", 0) > 0:
                    it_item = i_data["results"][0]
                    art = it_item.get("artworkUrl100", "").replace("100x100bb", "600x600bb")
                    prev = it_item.get("previewUrl", "")
                    if art:
                        cover_url = art
                    if prev:
                        preview_url = prev
        except Exception:
            pass  # Fallback to YouTube artwork and video link

        extracted_genres = []
        vec = GeminiEmbedder.embed_text_sync(f"Track: {song_name}. Artists: {artist}. YouTube Music")
        if vec:
            extracted_genres = GeminiEmbedder.infer_genres_from_embedding(vec, top_k=3)
            features = GeminiEmbedder.infer_acoustic_features_from_embedding(vec)
        else:
            extracted_genres = ["music"]
            features = {"energy": 0.60, "valence": 0.55, "danceability": 0.60, "acousticness": 0.20}

        return {
            "id": f"youtube:video:{vid}",
            "name": song_name,
            "artists": [artist],
            "album": "YouTube Music",
            "genres": extracted_genres,
            "source": "youtube",
            "cover_url": cover_url,
            "preview_url": preview_url,
            "uri": f"https://music.youtube.com/watch?v={vid}",
            "popularity": 85,
            "play_count": 3,
            "embedding": vec,
            "features": features
        }
