import re
import os
import time
import json
import httpx
from typing import List, Dict, Any, Optional, Set, Tuple
from backend.core.logger import logger
from backend.core.neo4j_driver import neo4j_conn
from backend.services.preview_service import PreviewVerifier, TokenBucketRateLimiter
from backend.embeddings.gemini_embedder import GeminiEmbedder

BLOCKLIST_REGEX = re.compile(
    r"\b(karaoke|tribute|8d|slowed|sped up|nightcore|type beat|instrumental cover|ringtone|remix cover)\b", 
    re.IGNORECASE
)

CHECKPOINT_PATH = os.path.join(os.path.dirname(__file__), "../data/catalog_expansion_checkpoint.json")

class CatalogExpander:
    """
    Workstream W3 Catalog Expansion Engine:
    Expands playable music catalog with verified studio previews (iTunes/Deezer),
    enforces strict quality gates, generates Gemini 768-D embeddings, and persists to Neo4j.
    """

    def __init__(
        self, 
        rate_per_minute: int = 60,
        checkpoint_path: str = CHECKPOINT_PATH
    ):
        self.rate_limiter = TokenBucketRateLimiter(rate_per_minute=rate_per_minute)
        self.verifier = PreviewVerifier()
        self.checkpoint_path = checkpoint_path
        os.makedirs(os.path.dirname(self.checkpoint_path), exist_ok=True)

    def load_checkpoint(self) -> Dict[str, Any]:
        if os.path.exists(self.checkpoint_path):
            try:
                with open(self.checkpoint_path, "r") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Error loading checkpoint: {e}")
        return {"processed_artists": [], "ingested_tracks_count": 0}

    def save_checkpoint(self, checkpoint: Dict[str, Any]):
        try:
            with open(self.checkpoint_path, "w") as f:
                json.dump(checkpoint, f, indent=2)
        except Exception as e:
            logger.warning(f"Error saving checkpoint: {e}")

    def fetch_seed_artists_from_graph(self) -> List[str]:
        """Fetches existing seed artists from Neo4j."""
        query = "MATCH (a:Artist) RETURN DISTINCT a.name AS name ORDER BY name"
        rows = neo4j_conn.query(query) or []
        return [r["name"] for r in rows if r.get("name") and len(r["name"].strip()) > 1]

    def query_itunes_top_tracks(self, artist_name: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Queries iTunes Search API for artist songs with rate limiting."""
        self.rate_limiter.acquire()
        url = "https://itunes.apple.com/search"
        params = {
            "term": artist_name,
            "entity": "song",
            "limit": limit
        }
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("results", [])
        except Exception as e:
            logger.warning(f"iTunes search failed for artist '{artist_name}': {e}")
        return []

    def passes_quality_gates(self, track: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Validates quality gates:
        1. Non-empty title and artist
        2. Blocklist regex check
        3. Duration between 60s and 600s
        4. Artwork present
        5. Playable audio preview verified strictly via PreviewVerifier
        """
        title = track.get("trackName") or track.get("name") or ""
        artist = track.get("artistName") or ""
        if not title.strip() or not artist.strip():
            return False, "missing_title_or_artist"

        if BLOCKLIST_REGEX.search(title) or BLOCKLIST_REGEX.search(artist):
            return False, "blocklisted_title_or_artist"

        duration_ms = track.get("trackTimeMillis") or track.get("duration_ms") or 0
        if duration_ms < 60000 or duration_ms > 600000:
            return False, f"invalid_duration_{duration_ms}ms"

        cover_url = track.get("artworkUrl100") or track.get("cover_url") or ""
        if not cover_url:
            return False, "missing_artwork"

        preview_url = track.get("previewUrl") or track.get("preview_url") or ""
        if not preview_url:
            return False, "missing_preview_url"

        # Verify preview url strictly (range GET, content-type audio/*, allowlisted CDN)
        is_ok, reason, _ = self.verifier.verify_url(preview_url)
        if not is_ok:
            return False, f"preview_failed_{reason}"

        return True, "ok"

    def ingest_batch_into_graph(self, candidates: List[Dict[str, Any]]) -> int:
        """Embeds candidates and writes them into Neo4j."""
        if not candidates:
            return 0

        # 1. Generate Gemini 768-D embeddings
        try:
            emb_map = GeminiEmbedder.embed_tracks_batch_sync(candidates)
        except Exception as e:
            logger.error(f"Error embedding candidate tracks batch: {e}")
            emb_map = {}

        valid_for_db = []
        for item in candidates:
            emb = emb_map.get(item["id"])
            if not emb or len(emb) != 768:
                continue
            item["embedding"] = emb
            # Derive acoustic features & genres
            features = GeminiEmbedder.infer_acoustic_features_from_embedding(emb)
            inferred_genres = GeminiEmbedder.infer_genres_from_embedding(emb, top_k=2)
            item["energy"] = features.get("energy", 0.5)
            item["valence"] = features.get("valence", 0.5)
            item["danceability"] = features.get("danceability", 0.5)
            item["acousticness"] = features.get("acousticness", 0.5)
            
            # Combine primary genre from iTunes with inferred genres
            all_genres = list(item.get("genres", []))
            all_genres.extend(inferred_genres)
            item["genres"] = list({g.strip().capitalize() for g in all_genres if g.strip()})
            valid_for_db.append(item)

        if not valid_for_db:
            return 0

        query = """
        UNWIND $batch AS item
        MERGE (t:Track {id: item.id})
        ON CREATE SET
            t.name = item.name,
            t.source = 'itunes',
            t.preview_url = item.preview_url,
            t.preview_source = 'itunes',
            t.preview_status = 'ok',
            t.match_confidence = 1.0,
            t.cover_url = item.cover_url,
            t.duration_ms = item.duration_ms,
            t.popularity = item.popularity,
            t.energy = item.energy,
            t.valence = item.valence,
            t.danceability = item.danceability,
            t.acousticness = item.acousticness,
            t.embedding = item.embedding,
            t.feature_source = 'text_proxy',
            t.feature_confidence = 0.65,
            t.created_at = datetime(),
            t.verified_at = datetime()
        WITH t, item
        FOREACH (art_name IN item.artists |
            MERGE (a:Artist {id: 'artist:' + toLower(trim(art_name))})
            ON CREATE SET a.name = art_name, a.source = 'itunes'
            MERGE (t)-[:BY]->(a)
        )
        WITH t, item
        FOREACH (gen_name IN item.genres |
            MERGE (g:Genre {name: toLower(trim(gen_name))})
            MERGE (t)-[:IN_GENRE]->(g)
        )
        RETURN count(t) AS inserted
        """
        try:
            res = neo4j_conn.query(query, {"batch": valid_for_db})
            inserted = res[0]["inserted"] if res else 0
            logger.info(f"Ingested {inserted} frontier tracks into Neo4j.")
            return inserted
        except Exception as e:
            logger.error(f"Error persisting frontier tracks to Neo4j: {e}")
            return 0

    def expand_catalog(
        self, 
        target_new_tracks: int = 500, 
        max_per_artist: int = 5,
        max_artists_to_scan: int = 150
    ) -> Dict[str, Any]:
        """
        Executes catalog expansion across seed artists up to target_new_tracks.
        """
        checkpoint = self.load_checkpoint()
        processed_set: Set[str] = set(checkpoint.get("processed_artists", []))
        
        # Get existing track IDs from Neo4j to avoid duplicate queries
        existing_tracks_query = "MATCH (t:Track) RETURN t.id AS id, toLower(t.name) AS name"
        existing_rows = neo4j_conn.query(existing_tracks_query) or []
        existing_track_ids: Set[str] = {r["id"] for r in existing_rows}
        existing_names: Set[str] = {r["name"] for r in existing_rows if r.get("name")}

        seed_artists = self.fetch_seed_artists_from_graph()
        logger.info(f"Loaded {len(seed_artists)} seed artists. ({len(processed_set)} already scanned in checkpoint)")

        candidates_buffer: List[Dict[str, Any]] = []
        total_ingested = checkpoint.get("ingested_tracks_count", 0)
        newly_ingested = 0
        artists_scanned = 0

        for artist_name in seed_artists:
            if artists_scanned >= max_artists_to_scan or newly_ingested >= target_new_tracks:
                break
            if artist_name in processed_set:
                continue

            artists_scanned += 1
            processed_set.add(artist_name)
            raw_results = self.query_itunes_top_tracks(artist_name, limit=max_per_artist * 2)

            artist_candidates = []
            for r in raw_results:
                tid = f"itunes:track:{r.get('trackId')}"
                tname = r.get("trackName", "")
                if tid in existing_track_ids or tname.lower() in existing_names:
                    continue

                passes, reason = self.passes_quality_gates(r)
                if not passes:
                    continue

                genres = []
                if r.get("primaryGenreName"):
                    genres.append(r["primaryGenreName"])

                artist_candidates.append({
                    "id": tid,
                    "name": tname,
                    "artists": [r.get("artistName", artist_name)],
                    "album": r.get("collectionName", "Single"),
                    "cover_url": r.get("artworkUrl100", "").replace("100x100bb", "600x600bb"),
                    "preview_url": r.get("previewUrl"),
                    "duration_ms": r.get("trackTimeMillis", 0),
                    "popularity": 65,
                    "genres": genres
                })
                existing_track_ids.add(tid)
                existing_names.add(tname.lower())

                if len(artist_candidates) >= max_per_artist:
                    break

            candidates_buffer.extend(artist_candidates)

            # Ingest when buffer reaches 25 tracks
            if len(candidates_buffer) >= 25:
                count = self.ingest_batch_into_graph(candidates_buffer)
                newly_ingested += count
                total_ingested += count
                candidates_buffer = []
                # Update checkpoint
                checkpoint["processed_artists"] = list(processed_set)
                checkpoint["ingested_tracks_count"] = total_ingested
                self.save_checkpoint(checkpoint)
                logger.info(f"Progress: newly ingested {newly_ingested}/{target_new_tracks} tracks (scanned {artists_scanned} artists).")

        # Ingest remainder
        if candidates_buffer:
            count = self.ingest_batch_into_graph(candidates_buffer)
            newly_ingested += count
            total_ingested += count
            checkpoint["processed_artists"] = list(processed_set)
            checkpoint["ingested_tracks_count"] = total_ingested
            self.save_checkpoint(checkpoint)

        return {
            "status": "success",
            "artists_scanned": artists_scanned,
            "newly_ingested_tracks": newly_ingested,
            "total_ingested_tracks": total_ingested
        }
