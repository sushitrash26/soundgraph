import spotipy
from spotipy.oauth2 import SpotifyOAuth
from typing import List, Dict, Any, Optional
import urllib.parse
import urllib.request
import json
from backend.core.config import settings
from backend.core.logger import logger
from backend.ingestors.base import BaseIngestor

SPOTIFY_SCOPES = [
    "user-top-read",
    "user-read-recently-played",
    "user-library-read",
    "playlist-read-private",
    "playlist-read-collaborative",
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
    def get_oauth_manager(cls, redirect_uri: Optional[str] = None) -> SpotifyOAuth:
        return SpotifyOAuth(
            client_id=settings.SPOTIFY_CLIENT_ID,
            client_secret=settings.SPOTIFY_CLIENT_SECRET,
            redirect_uri=redirect_uri or settings.SPOTIFY_REDIRECT_URI,
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

        # 1. Top Tracks across all 3 time horizons (short_term, medium_term, long_term)
        for time_range in ["short_term", "medium_term", "long_term"]:
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

        # 3. Saved / Liked Tracks with pagination (up to 200 items)
        offset = 0
        while offset < 200:
            try:
                saved = self.sp.current_user_saved_tracks(limit=50, offset=offset)
                items = saved.get("items", [])
                if not items:
                    break
                for item in items:
                    tr = item.get("track")
                    if tr and tr.get("id"):
                        tid = f"spotify:track:{tr['id']}"
                        if tid not in tracks_dict:
                            tracks_dict[tid] = self._normalize_track(tr)
                        tracks_dict[tid]["play_count"] += 1
                offset += len(items)
                if len(items) < 50:
                    break
            except Exception as e:
                logger.warning(f"Error fetching saved tracks (offset {offset}): {e}")
                break

        # 4. User Playlists and Playlist Items
        try:
            playlists = self.sp.current_user_playlists(limit=25)
            for pl in (playlists.get("items", []) or []):
                pl_id = pl.get("id")
                if pl_id:
                    pl_items = self.sp.playlist_items(pl_id, limit=50)
                    for p_item in (pl_items.get("items", []) or []):
                        tr = p_item.get("track")
                        if tr and tr.get("id"):
                            tid = f"spotify:track:{tr['id']}"
                            if tid not in tracks_dict:
                                tracks_dict[tid] = self._normalize_track(tr)
                            tracks_dict[tid]["play_count"] += 1
        except Exception as e:
            logger.warning(f"Error fetching user playlists: {e}")

        # 5. Audio Features in chunks of 50
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

        # 6. Fallback Preview URL Enrichment if missing
        for tid, tr in tracks_dict.items():
            if not tr.get("preview_url") or not tr.get("cover_url"):
                try:
                    q = urllib.parse.quote(f"{tr['name']} {tr['artists'][0] if tr['artists'] else ''}".strip())
                    url = f"https://itunes.apple.com/search?term={q}&entity=song&limit=1"
                    req = urllib.request.Request(url, headers={"User-Agent": "SoundGraph/1.0"})
                    with urllib.request.urlopen(req, timeout=1.5) as resp:
                        d = json.loads(resp.read().decode())
                        if d.get("resultCount", 0) > 0:
                            item = d["results"][0]
                            if not tr.get("preview_url"):
                                tr["preview_url"] = item.get("previewUrl", "")
                            if not tr.get("cover_url"):
                                tr["cover_url"] = item.get("artworkUrl100", "").replace("100x100bb", "600x600bb")
                except Exception:
                    pass

        logger.info(f"Spotify ingestion fetched {len(tracks_dict)} unique tracks with features.")
        return list(tracks_dict.values())

    def _normalize_track(self, item: Dict[str, Any]) -> Dict[str, Any]:
        artists = [a["name"] for a in item.get("artists", []) if a.get("name")]
        album_obj = item.get("album") or {}
        album_name = album_obj.get("name") if album_obj else ""
        images = album_obj.get("images") or []
        cover_url = images[0].get("url") if images else ""
        preview_url = item.get("preview_url") or ""
        return {
            "id": f"spotify:track:{item['id']}",
            "name": item.get("name", "Unknown Track"),
            "artists": artists,
            "album": album_name,
            "genres": [],
            "source": "spotify",
            "cover_url": cover_url,
            "preview_url": preview_url,
            "uri": item.get("uri"),
            "duration_ms": item.get("duration_ms", 0),
            "popularity": item.get("popularity", 50),
            "play_count": 1,
            "features": {}
        }
