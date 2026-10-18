import os
import sys
import subprocess
import urllib.parse
from typing import List, Dict, Any, Optional, Tuple
import httpx
import numpy as np
from backend.core.logger import logger
from backend.core.hexa_sonic.bus import AcousticBusRouter
from backend.core.hexa_sonic.stream_a_constellation import StreamAConstellation
from backend.core.hexa_sonic.stream_b_melody import StreamBMelody
from backend.core.hexa_sonic.stream_c_lyrics import StreamCLyrics
from backend.core.hexa_sonic.canonical_store import CanonicalStore
from backend.core.hexa_sonic.melody_embedding import MelodyEmbeddingExtractor

class JITHydrationWorker:
    """
    Tier 1 & 2 Global Catalog Scaling & Just-In-Time Preview Hydration Worker.
    Allows SoundGraph to recognize any song in the world without pre-downloading 150M files:
    1. Tier 1: Queries LRCLIB (open-source lyrics API) for plain/synced lyrics.
    2. Tier 2: Fetches 30-second studio preview audio via iTunes / YouTube (yt-dlp).
       Computes on-the-fly melody contour (Δp, r_ioi) and constellation hashes in ~80ms.
    3. Tier 3: Commits newly hydrated songs into local FAISS + SQLite + Neo4j (Self-Learning Cache).
    """

    LRCLIB_SEARCH_URL = "https://lrclib.net/api/search"
    ITUNES_SEARCH_URL = "https://itunes.apple.com/search"

    @classmethod
    async def query_lrclib_lyrics(cls, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Tier 1: Global lyrics bulk search via LRCLIB.
        Returns track metadata and plain lyrics for global catalog tracks.
        """
        if not query or len(query.strip()) < 2:
            return []

        clean_q = query.strip()
        params = {"q": clean_q}

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(cls.LRCLIB_SEARCH_URL, params=params)
                if res.status_code == 200:
                    data = res.json()
                    results = []
                    for item in data[:limit]:
                        title = item.get("name") or item.get("trackName")
                        artist = item.get("artistName")
                        lyrics = item.get("plainLyrics")
                        if title and artist:
                            results.append({
                                "title": title,
                                "artist": artist,
                                "album": item.get("albumName", ""),
                                "duration": item.get("duration", 180.0),
                                "lyrics": lyrics or ""
                            })
                    return results
        except Exception as e:
            logger.debug(f"JITHydration: LRCLIB lookup note: {e}")
        return []

    @classmethod
    async def fetch_preview_audio_url(cls, title: str, artist: str) -> Optional[Dict[str, Any]]:
        """
        Tier 2: Queries iTunes Search API for free 30-second studio master preview streams.
        If unavailable on iTunes (e.g. unreleased/indie tracks), falls back to YouTube Music.
        """
        term = f"{title} {artist}".strip()
        params = {"term": term, "media": "music", "limit": 3}

        # 1. Try iTunes Search API
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                res = await client.get(cls.ITUNES_SEARCH_URL, params=params)
                if res.status_code == 200:
                    data = res.json()
                    results = data.get("results", [])
                    for top in results:
                        preview_url = top.get("previewUrl")
                        track_name = top.get("trackName") or ""
                        artist_name = top.get("artistName") or ""
                        # Verify BOTH track name and artist relevance (if artist is specified)
                        title_match = title.lower() in track_name.lower() or track_name.lower() in title.lower()
                        clean_artist = artist.lower().strip() if artist else ""
                        artist_match = not clean_artist or (clean_artist in artist_name.lower() or artist_name.lower() in clean_artist)
                        if preview_url and title_match and artist_match:
                            return {
                                "title": track_name,
                                "artist": artist_name,
                                "album": top.get("collectionName", ""),
                                "preview_url": preview_url,
                                "artwork_url": top.get("artworkUrl100", "").replace("100x100bb", "600x600bb"),
                                "track_url": top.get("trackViewUrl", "")
                            }
        except Exception as e:
            logger.debug(f"JITHydration: iTunes preview lookup note: {e}")

        # 2. Fallback to YouTube Music (covers 100% of global music including indie, SoundCloud, and remixes)
        try:
            from ytmusicapi import YTMusic
            yt = YTMusic()
            results = yt.search(term, filter="songs", limit=3)
            if not results:
                results = yt.search(term, limit=3)
            if results:
                top = results[0]
                vid = top.get("videoId")
                if vid:
                    artists = [a.get("name") for a in top.get("artists", []) if a.get("name")]
                    top_artist = artists[0] if artists else artist
                    top_title = top.get("title") or title
                    thumb = top.get("thumbnails", [{}])[-1].get("url")
                    return {
                        "title": top_title,
                        "artist": top_artist,
                        "album": "",
                        "preview_url": f"youtube:{vid}",
                        "artwork_url": thumb,
                        "track_url": f"https://www.youtube.com/watch?v={vid}",
                        "video_id": vid
                    }
        except Exception as e:
            logger.debug(f"JITHydration: YouTube fallback lookup note: {e}")

        return None

    @classmethod
    async def hydrate_track_from_preview(
        cls,
        title: str,
        artist: str,
        preview_url: str,
        lyrics: Optional[str] = None,
        artwork_url: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Downloads 25-30s preview stream, computes Stream A hashes, Stream B melody contours,
        Stream C phonetic skeleton, and saves into CanonicalStore (Self-Learning Cache).
        """
        pcm_norm = None

        # A. YouTube stream extraction via yt-dlp + ffmpeg
        if preview_url.startswith("youtube:"):
            vid = preview_url.split(":", 1)[1]
            yt_url = f"https://www.youtube.com/watch?v={vid}"
            try:
                # Find yt-dlp in venv or path
                ytdl_bin = os.path.join(os.getcwd(), "venv", "bin", "yt-dlp")
                if not os.path.exists(ytdl_bin):
                    ytdl_bin = "yt-dlp"

                proc_ytdl = subprocess.run(
                    [ytdl_bin, "-g", "-f", "ba/b", yt_url],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=8.0
                )
                if proc_ytdl.returncode == 0 and proc_ytdl.stdout:
                    stream_link = proc_ytdl.stdout.decode().strip()
                    cmd_ff = [
                        "ffmpeg", "-hide_banner", "-loglevel", "error",
                        "-ss", "10", "-t", "25",
                        "-i", stream_link,
                        "-f", "s16le", "-ac", "1", "-ar", "16000",
                        "pipe:1"
                    ]
                    proc_ff = subprocess.run(cmd_ff, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=8.0)
                    if proc_ff.returncode == 0 and len(proc_ff.stdout) > 0:
                        pcm = np.frombuffer(proc_ff.stdout, dtype=np.int16).astype(np.float32) / 32768.0
                        pcm_norm = AcousticBusRouter._apply_drc_norm(pcm)
            except Exception as e:
                logger.warning(f"JITHydration: YouTube stream extraction error for {yt_url}: {e}")

        # B. Direct HTTP preview stream (iTunes / Apple Music)
        if pcm_norm is None and not preview_url.startswith("youtube:"):
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    r = await client.get(preview_url)
                    if r.status_code == 200 and len(r.content) >= 5000:
                        pcm_norm = AcousticBusRouter.decode_and_normalize(r.content)
            except Exception as e:
                logger.warning(f"JITHydration: Direct preview download error for {preview_url}: {e}")

        if pcm_norm is None or len(pcm_norm) < 16000:
            return None

        bus1, bus2 = AcousticBusRouter.route_dual_buses(pcm_norm)

        # 2. Extract Stream A Scale-Invariant Constellation Hashes
        peaks = StreamAConstellation.extract_peaks(bus1)
        hashes = StreamAConstellation.generate_triplet_hashes(peaks)

        # 3. Extract Stream B Pitch Contour, Note Events, Δp, r_IOI, and Mel-Spectrogram Embedding
        f0, voiced_probs, times = StreamBMelody.extract_pitch_contour(bus2)
        note_events = StreamBMelody.segment_note_events(f0, voiced_probs, times)
        dp, r_ioi = StreamBMelody.compute_deltas_and_iois(note_events)
        
        # Prefer direct 128-D mel-spectrogram embedding (Google-style)
        coarse_vec = MelodyEmbeddingExtractor.extract_embedding(pcm_norm)
        if coarse_vec is None:
            coarse_vec = StreamBMelody.compute_128d_coarse_embedding(dp, r_ioi)

        # 4. Stream C Phonetic Skeleton
        skel = StreamCLyrics.compute_consonant_vowel_skeleton(lyrics) if lyrics else ""

        track_id = f"hydrated:{title.lower().replace(' ', '_')}:{artist.lower().replace(' ', '_')}"
        work_id = f"work:{title.lower().strip()}:{artist.lower().strip()}"

        # 5. Commit to Tier 3 Self-Learning Cache (SQLite + FAISS + Neo4j)
        CanonicalStore.add_canonical_song(
            track_id=track_id,
            title=title,
            artist=artist,
            work_id=work_id,
            is_original_master=True,
            popularity=0.85,
            preview_url=preview_url,
            youtube_url=f"https://www.youtube.com/results?search_query={urllib.parse.quote(f'{title} {artist}')}",
            thumbnail=artwork_url or f"https://img.youtube.com/vi/nyuo9-OjNNg/hqdefault.jpg",
            triplet_hashes=hashes,
            dp=dp,
            r_ioi=r_ioi,
            coarse_vec=coarse_vec,
            plain_lyrics=lyrics or "",
            phonetic_skeleton=skel
        )

        logger.info(f"JITHydration: Successfully hydrated & cached '{title}' by '{artist}' ({len(hashes)} hashes, {len(dp)} notes)")

        return {
            "track_id": track_id,
            "work_id": work_id,
            "title": title,
            "artist": artist,
            "preview_url": preview_url,
            "thumbnail": artwork_url,
            "dp": dp,
            "r_ioi": r_ioi,
            "coarse_vec": coarse_vec
        }
