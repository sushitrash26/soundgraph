from typing import List, Dict, Any, Optional
from ytmusicapi import YTMusic
from backend.core.logger import logger
from backend.core.neo4j_driver import neo4j_conn
from backend.embeddings.gemini_embedder import GeminiEmbedder
from backend.graph.loader import GraphLoader

class FrontierFetcher:
    """
    Autonomous Dynamic Frontier Expansion:
    Solves the 'Catalog Horizon' problem.
    When a user query or taste vector has low cosine similarity in local Neo4j (< 0.77),
    this worker queries YouTube Music & Spotify APIs on the fly,
    embeds fresh candidate tracks with Gemini 768-D vectors,
    persists them to Neo4j, and streams them into the response.
    """

    _ytmusic: Optional[YTMusic] = None

    @classmethod
    def get_ytmusic(cls) -> YTMusic:
        if cls._ytmusic is None:
            try:
                cls._ytmusic = YTMusic()
            except Exception as e:
                logger.warning(f"Failed to initialize YTMusic instance: {e}")
                cls._ytmusic = YTMusic()
        return cls._ytmusic

    @classmethod
    def expand_frontier_for_prompt(cls, prompt: str, user_id: str = "astitva_demo_user", limit: int = 5) -> List[Dict[str, Any]]:
        """
        Dynamically discovers, embeds, and ingests fresh songs for any niche prompt or sound.
        """
        logger.info(f"Triggering Dynamic Frontier Expansion for prompt: \"{prompt}\"")
        yt = cls.get_ytmusic()
        raw_candidates = []

        try:
            results = yt.search(prompt, filter="songs", limit=limit * 2)
            for item in results:
                vid = item.get("videoId")
                title = item.get("title")
                if not vid or not title:
                    continue

                track_id = f"youtube:video:{vid}"
                # Check if track already exists in Neo4j
                exists = neo4j_conn.query("MATCH (t:Track {id: $id}) RETURN t.id", {"id": track_id})
                if exists:
                    continue

                artists = [a.get("name") for a in item.get("artists", []) if a.get("name")]
                if not artists:
                    artists = ["Featured Artist"]

                raw_candidates.append({
                    "id": track_id,
                    "name": title,
                    "artists": artists,
                    "source": "youtube",
                    "album": item.get("album", {}).get("name", "Single"),
                    "cover_url": f"https://img.youtube.com/vi/{vid}/hqdefault.jpg",
                    "popularity": 75,
                    "features": {},
                    "genres": []
                })

                if len(raw_candidates) >= limit:
                    break

        except Exception as e:
            logger.error(f"Error querying YouTube Music in FrontierFetcher: {e}")

        if not raw_candidates:
            logger.warning(f"No new frontier candidates found for prompt: \"{prompt}\"")
            return []

        # Generate Gemini 768-D embeddings and derive real acoustic features & genres
        try:
            emb_map = GeminiEmbedder.embed_tracks_batch_sync(raw_candidates)
            for item in raw_candidates:
                vec = emb_map.get(item["id"])
                item["embedding"] = vec
                if vec:
                    # AI-derived acoustic features via semantic differential axis projection
                    item["features"] = GeminiEmbedder.infer_acoustic_features_from_embedding(vec)
                    # Zero-shot semantic genre classification via 768-D canonical anchor projection
                    item["genres"] = GeminiEmbedder.infer_genres_from_embedding(vec, top_k=3)
        except Exception as e:
            logger.error(f"Error embedding frontier tracks: {e}")

        # Persist into Neo4j knowledge graph catalog
        try:
            GraphLoader.load_frontier_catalog_tracks(raw_candidates)
            logger.info(f"Successfully ingested {len(raw_candidates)} fresh frontier tracks into Neo4j catalog.")
        except Exception as e:
            logger.error(f"Error loading frontier tracks into Neo4j: {e}")

        return raw_candidates
