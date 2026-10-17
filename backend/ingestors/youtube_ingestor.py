import json
from typing import List, Dict, Any, Optional
from ytmusicapi import YTMusic
from backend.core.logger import logger
from backend.ingestors.base import BaseIngestor
from backend.embeddings.gemini_embedder import GeminiEmbedder

class YouTubeMusicIngestor(BaseIngestor):
    def __init__(self, auth_headers: Optional[Dict[str, Any]] = None):
        self.yt: Optional[YTMusic] = None
        if auth_headers:
            try:
                # Can be passed as raw dict or json string
                self.yt = YTMusic(auth_headers)
            except Exception as e:
                logger.warning(f"Failed to initialize YTMusic with provided headers: {e}")
        else:
            try:
                # Default anonymous / search mode
                self.yt = YTMusic()
            except Exception as e:
                logger.warning(f"Anonymous YTMusic initialization warning: {e}")

    def fetch_user_profile(self) -> Dict[str, Any]:
        return {
            "id": "youtube:current_user",
            "name": "YouTube Music Explorer",
            "source": "youtube",
            "avatar_url": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150"
        }

    def fetch_listening_data(self) -> List[Dict[str, Any]]:
        tracks_dict: Dict[str, Dict[str, Any]] = {}
        if not self.yt:
            logger.info("YTMusic instance not initialized; using public query fallback.")
            return []

        try:
            # 1. Liked songs / Library songs
            library_songs = self.yt.get_library_songs(limit=50)
            for item in library_songs:
                vid = item.get("videoId")
                if vid:
                    key = f"youtube:video:{vid}"
                    tracks_dict[key] = self._normalize_yt_track(item)
        except Exception as e:
            logger.warning(f"Could not fetch YT library songs: {e}")

        try:
            # 2. History
            history = self.yt.get_history()
            for item in (history or [])[:30]:
                vid = item.get("videoId")
                if vid:
                    key = f"youtube:video:{vid}"
                    if key in tracks_dict:
                        tracks_dict[key]["play_count"] += 1
                    else:
                        tracks_dict[key] = self._normalize_yt_track(item)
        except Exception as e:
            logger.warning(f"Could not fetch YT history: {e}")

        logger.info(f"YouTube Music ingestion fetched {len(tracks_dict)} tracks.")
        return list(tracks_dict.values())

    def fetch_playlist_tracks(self, playlist_id_or_url: str) -> List[Dict[str, Any]]:
        """Ingests tracks from any public, unlisted, or personal YouTube Music playlist"""
        # Extract ID if URL passed
        p_id = playlist_id_or_url
        if "list=" in playlist_id_or_url:
            p_id = playlist_id_or_url.split("list=")[-1].split("&")[0]

        logger.info(f"Fetching YouTube Music playlist tracks for ID: {p_id}")
        if not self.yt:
            self.yt = YTMusic()

        try:
            res = self.yt.get_playlist(p_id, limit=50)
            tracks = []
            for item in res.get("tracks", []):
                if item.get("videoId"):
                    tracks.append(self._normalize_yt_track(item))
            logger.info(f"Fetched {len(tracks)} tracks from YouTube playlist {p_id}")
            return tracks
        except Exception as e:
            logger.error(f"Error fetching YT playlist: {e}")
            raise e

    def fetch_search_tracks(self, query: str, limit: int = 15) -> List[Dict[str, Any]]:
        """Fetches tracks for any artist or genre search query"""
        if not self.yt:
            self.yt = YTMusic()
        try:
            results = self.yt.search(query, filter="songs", limit=limit)
            tracks = []
            for item in results:
                if item.get("videoId"):
                    tracks.append(self._normalize_yt_track(item))
            return tracks
        except Exception as e:
            logger.error(f"Error searching YT tracks: {e}")
            return []

    def _normalize_yt_track(self, item: Dict[str, Any]) -> Dict[str, Any]:
        vid = item.get("videoId")
        artists = [a.get("name") for a in item.get("artists", []) if a.get("name")]
        album_name = item.get("album", {}).get("name") if item.get("album") else ""
        title = item.get("title", "Unknown Video")

        cover_url = f"https://img.youtube.com/vi/{vid}/hqdefault.jpg" if vid else ""

        # Zero-shot AI genre & acoustic feature derivation via Gemini-2
        vec = GeminiEmbedder.embed_text_sync(f"Track: {title}. Artists: {', '.join(artists)}. Album: {album_name}")
        if vec:
            genres = GeminiEmbedder.infer_genres_from_embedding(vec, top_k=3)
            features = GeminiEmbedder.infer_acoustic_features_from_embedding(vec)
        else:
            genres = ["music"]
            features = {"energy": 0.50, "valence": 0.50, "danceability": 0.50, "acousticness": 0.30}

        return {
            "id": f"youtube:video:{vid}",
            "name": title,
            "artists": artists,
            "album": album_name,
            "genres": genres,
            "source": "youtube",
            "cover_url": cover_url,
            "uri": f"https://music.youtube.com/watch?v={vid}",
            "duration_ms": item.get("duration_seconds", 0) * 1000 if item.get("duration_seconds") else 0,
            "popularity": 70,
            "play_count": 1,
            "embedding": vec,
            "features": features
        }
