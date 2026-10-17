import spotipy
from spotipy.oauth2 import SpotifyOAuth
from typing import List, Dict, Any, Optional
from backend.core.config import settings
from backend.core.logger import logger
from backend.ingestors.base import BaseIngestor

SPOTIFY_SCOPES = [
    "user-top-read",
    "user-read-recently-played",
    "user-library-read",
    "user-read-email",
    "user-read-private",
]

class SpotifyIngestor(BaseIngestor):
    def __init__(self, auth_token: Optional[str] = None):
        self.auth_token = auth_token
        self.sp: Optional[spotipy.Spotify] = None
        if auth_token:
            self.sp = spotipy.Spotify(auth=auth_token)

    @classmethod
    def get_oauth_manager(cls) -> SpotifyOAuth:
        return SpotifyOAuth(
            client_id=settings.SPOTIFY_CLIENT_ID,
            client_secret=settings.SPOTIFY_CLIENT_SECRET,
            redirect_uri=settings.SPOTIFY_REDIRECT_URI,
            scope=" ".join(SPOTIFY_SCOPES),
            cache_path=".spotify_cache"
        )

    def fetch_user_profile(self) -> Dict[str, Any]:
        if not self.sp:
            raise ValueError("Spotify client not authenticated")
        me = self.sp.current_user()
        images = me.get("images") or []
        avatar = images[0].get("url") if images else ""
        return {
            "id": f"spotify:{me['id']}",
            "name": me.get("display_name") or me.get("id"),
            "source": "spotify",
            "avatar_url": avatar
        }

    def fetch_listening_data(self) -> List[Dict[str, Any]]:
        if not self.sp:
            raise ValueError("Spotify client not authenticated")

        tracks_dict: Dict[str, Dict[str, Any]] = {}

        # 1. Top Tracks (short_term, medium_term)
        for time_range in ["short_term", "medium_term"]:
            try:
                top = self.sp.current_user_top_tracks(limit=50, time_range=time_range)
                for item in top.get("items", []):
                    tid = f"spotify:track:{item['id']}"
                    if tid not in tracks_dict:
                        tracks_dict[tid] = self._normalize_track(item)
                    tracks_dict[tid]["play_count"] += 2
            except Exception as e:
                logger.warning(f"Error fetching top tracks ({time_range}): {e}")

        # 2. Recently Played Tracks
        try:
            recent = self.sp.current_user_recently_played(limit=50)
            for item in recent.get("items", []):
                tr = item.get("track")
                if tr:
                    tid = f"spotify:track:{tr['id']}"
                    if tid not in tracks_dict:
                        tracks_dict[tid] = self._normalize_track(tr)
                    tracks_dict[tid]["play_count"] += 1
        except Exception as e:
            logger.warning(f"Error fetching recently played: {e}")

        # 3. Saved / Liked Tracks
        try:
            saved = self.sp.current_user_saved_tracks(limit=50)
            for item in saved.get("items", []):
                tr = item.get("track")
                if tr:
                    tid = f"spotify:track:{tr['id']}"
                    if tid not in tracks_dict:
                        tracks_dict[tid] = self._normalize_track(tr)
                    tracks_dict[tid]["play_count"] += 1
        except Exception as e:
            logger.warning(f"Error fetching saved tracks: {e}")

        # 4. Audio Features in chunks of 50
        raw_ids = [tid.replace("spotify:track:", "") for tid in tracks_dict.keys()]
        for i in range(0, len(raw_ids), 50):
            chunk = raw_ids[i:i+50]
            try:
                features_list = self.sp.audio_features(chunk)
                for f in (features_list or []):
                    if f and f.get("id"):
                        key = f"spotify:track:{f['id']}"
                        if key in tracks_dict:
                            tracks_dict[key]["features"] = {
                                "energy": f.get("energy"),
                                "valence": f.get("valence"),
                                "danceability": f.get("danceability"),
                                "tempo": f.get("tempo"),
                                "acousticness": f.get("acousticness"),
                                "instrumentalness": f.get("instrumentalness")
                            }
            except Exception as e:
                logger.warning(f"Error fetching audio features chunk: {e}")

        logger.info(f"Spotify ingestion fetched {len(tracks_dict)} unique tracks with features.")
        return list(tracks_dict.values())

    def _normalize_track(self, item: Dict[str, Any]) -> Dict[str, Any]:
        artists = [a["name"] for a in item.get("artists", []) if a.get("name")]
        album_name = item.get("album", {}).get("name") if item.get("album") else ""
        return {
            "id": f"spotify:track:{item['id']}",
            "name": item.get("name", "Unknown Track"),
            "artists": artists,
            "album": album_name,
            "genres": [],  # Will be populated or linked via artist
            "source": "spotify",
            "uri": item.get("uri"),
            "duration_ms": item.get("duration_ms", 0),
            "popularity": item.get("popularity", 50),
            "play_count": 1,
            "features": {}
        }
