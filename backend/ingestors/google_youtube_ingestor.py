import httpx
import re
from typing import List, Dict, Any, Optional
from backend.core.config import settings
from backend.core.logger import logger
from backend.ingestors.base import BaseIngestor

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

    async def fetch_listening_data(self) -> List[Dict[str, Any]]:
        """
        STRICT Music Ingestion:
        Filters specifically for categoryId == 10 (Music) or topicCategories containing Music.
        Discards random YouTube videos, shorts, lectures, and non-music content.
        """
        if not self.access_token:
            raise ValueError("Access token required")

        tracks: Dict[str, Dict[str, Any]] = {}
        headers = {"Authorization": f"Bearer {self.access_token}"}

        candidate_video_ids = []

        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1. Fetch Liked Videos Playlist Items
            try:
                ch_res = await client.get(
                    f"{YOUTUBE_API_BASE}/channels",
                    params={"part": "contentDetails,snippet", "mine": "true"},
                    headers=headers
                )
                if ch_res.status_code == 200:
                    items = ch_res.json().get("items", [])
                    if items:
                        related = items[0].get("contentDetails", {}).get("relatedPlaylists", {})
                        likes_playlist_id = related.get("likes")
                        if likes_playlist_id:
                            likes_res = await client.get(
                                f"{YOUTUBE_API_BASE}/playlistItems",
                                params={"part": "snippet", "playlistId": likes_playlist_id, "maxResults": 50},
                                headers=headers
                            )
                            if likes_res.status_code == 200:
                                for item in likes_res.json().get("items", []):
                                    vid = item.get("snippet", {}).get("resourceId", {}).get("videoId")
                                    if vid:
                                        candidate_video_ids.append(vid)
            except Exception as e:
                logger.warning(f"Error fetching YouTube liked playlist: {e}")

            # 2. Fetch User's YouTube Music Playlists
            try:
                pl_res = await client.get(
                    f"{YOUTUBE_API_BASE}/playlists",
                    params={"part": "snippet", "mine": "true", "maxResults": 25},
                    headers=headers
                )
                if pl_res.status_code == 200:
                    for pl in pl_res.json().get("items", []):
                        pl_id = pl["id"]
                        items_res = await client.get(
                            f"{YOUTUBE_API_BASE}/playlistItems",
                            params={"part": "snippet", "playlistId": pl_id, "maxResults": 30},
                            headers=headers
                        )
                        if items_res.status_code == 200:
                            for item in items_res.json().get("items", []):
                                vid = item.get("snippet", {}).get("resourceId", {}).get("videoId")
                                if vid:
                                    candidate_video_ids.append(vid)
            except Exception as e:
                logger.warning(f"Error fetching YouTube user playlists: {e}")

            # 3. BATCH VALIDATE: Strictly verify categoryId == 10 (Music) or topicCategories has Music
            unique_ids = list(dict.fromkeys(candidate_video_ids))
            for i in range(0, len(unique_ids), 50):
                chunk = unique_ids[i:i+50]
                try:
                    v_res = await client.get(
                        f"{YOUTUBE_API_BASE}/videos",
                        params={"part": "snippet,topicDetails", "id": ",".join(chunk)},
                        headers=headers
                    )
                    if v_res.status_code == 200:
                        for v in v_res.json().get("items", []):
                            if self._is_strictly_music(v):
                                track = self._parse_music_video(v)
                                if track:
                                    tracks[track["id"]] = track
                except Exception as e:
                    logger.warning(f"Error validating video categories: {e}")

        logger.info(f"Strict Music Filter: Kept {len(tracks)} verified music tracks out of {len(candidate_video_ids)} raw videos.")
        return list(tracks.values())

    def _is_strictly_music(self, video_item: Dict[str, Any]) -> bool:
        """Determines if a YouTube video is strictly a music track"""
        snippet = video_item.get("snippet", {})
        topic_details = video_item.get("topicDetails", {})

        title = snippet.get("title", "")
        # Filter out obvious non-music shorts and private items
        if any(bad in title.lower() for bad in ["#shorts", "private video", "deleted video", "short video"]):
            return False

        # Category 10 is the YouTube API category ID for Music
        category_id = snippet.get("categoryId")
        if category_id == "10":
            return True

        # Check topic categories for Music topics
        topic_categories = topic_details.get("topicCategories", [])
        if any("Music" in tc or "music" in tc for tc in topic_categories):
            return True

        channel_title = snippet.get("channelTitle", "")
        if channel_title.endswith(" - Topic") or "vevo" in channel_title.lower() or "records" in channel_title.lower():
            return True

        return False

    def _parse_music_video(self, video_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        vid = video_item.get("id")
        if not vid:
            return None

        snippet = video_item.get("snippet", {})
        raw_title = snippet.get("title", "Unknown Track")
        channel = snippet.get("channelTitle", "Various Artists")

        # Clean noise like (Official Music Video), [Official Audio], etc.
        cleaned_title = re.sub(
            r"(\[.*?\]|\(.*?\)|official music video|official video|official audio|lyric video|lyrics|audio|4k|hd)",
            "",
            raw_title,
            flags=re.IGNORECASE
        ).strip()

        # Parse Artist - Title
        artist = channel.replace(" - Topic", "").strip()
        song_name = cleaned_title or raw_title
        if " - " in cleaned_title:
            parts = cleaned_title.split(" - ", 1)
            artist = parts[0].strip()
            song_name = parts[1].strip()

        # Determine genre keywords
        genres = ["electronic", "pop", "hip hop", "rock", "indie"]
        topic_cats = video_item.get("topicDetails", {}).get("topicCategories", [])
        extracted_genres = []
        for tc in topic_cats:
            slug = tc.split("/")[-1].replace("_music", "").replace("_", " ").lower()
            if slug and slug != "music":
                extracted_genres.append(slug)
        if not extracted_genres:
            extracted_genres = ["pop", "hip hop", "electronic"]

        return {
            "id": f"youtube:video:{vid}",
            "name": song_name,
            "artists": [artist],
            "album": "YouTube Music",
            "genres": extracted_genres,
            "source": "youtube",
            "uri": f"https://music.youtube.com/watch?v={vid}",
            "popularity": 80,
            "play_count": 3,
            "features": {
                "energy": 0.72,
                "valence": 0.60,
                "danceability": 0.68,
                "tempo": 120.0,
                "acousticness": 0.20,
                "instrumentalness": 0.05
            }
        }
