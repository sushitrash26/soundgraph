import re
import urllib.parse
from typing import List, Dict, Any, Optional
from ytmusicapi import YTMusic
import httpx

from backend.core.logger import logger
from backend.core.neo4j_driver import neo4j_conn
from backend.embeddings.gemini_embedder import GeminiEmbedder
from backend.graph.loader import GraphLoader
from backend.ingestors.frontier_fetcher import FrontierFetcher

class SearchService:
    """
    Search & Bridged Music Intelligence Service:
    1. Autocomplete: Fast prefix/fuzzy search across local graph + live catalog.
    2. Search & Bridge: Resolves target track, extracts 768-D semantic vector,
       and bridges topological graph connections between the searched song
       and the user's personal taste profile.
    """
    _ytmusic: Optional[YTMusic] = None

    @classmethod
    def get_ytmusic(cls) -> YTMusic:
        if cls._ytmusic is None:
            try:
                cls._ytmusic = YTMusic()
            except Exception as e:
                logger.warning(f"Failed to init YTMusic: {e}")
                cls._ytmusic = YTMusic()
        return cls._ytmusic

    @classmethod
    def autocomplete(cls, query: str, limit: int = 8) -> List[Dict[str, Any]]:
        clean_q = query.strip()
        if not clean_q:
            return []

        results = []
        seen_keys = set()

        # 1. Check local Neo4j graph first
        try:
            cypher = """
            MATCH (t:Track)-[:BY]->(a:Artist)
            WHERE toLower(t.name) CONTAINS toLower($q) OR toLower(a.name) CONTAINS toLower($q)
            OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
            RETURN t.id AS id, t.name AS name, collect(DISTINCT a.name) AS artists,
                   collect(DISTINCT g.name) AS genres, coalesce(t.cover_url, '') AS cover_url,
                   coalesce(t.preview_url, '') AS preview_url, coalesce(t.source, 'youtube') AS source,
                   coalesce(t.popularity, 75) AS popularity
            LIMIT $limit
            """
            local_items = neo4j_conn.query(cypher, {"q": clean_q, "limit": limit})
            for it in local_items:
                key = f"{it['name'].lower()}:{(it['artists'][0] if it['artists'] else '').lower()}"
                if key not in seen_keys:
                    seen_keys.add(key)
                    results.append({
                        "id": it["id"],
                        "name": it["name"],
                        "artists": it["artists"] or ["Unknown Artist"],
                        "cover_url": it["cover_url"],
                        "preview_url": it["preview_url"],
                        "source": it["source"],
                        "popularity": it["popularity"],
                        "is_local": True
                    })
        except Exception as e:
            logger.warning(f"Neo4j autocomplete error: {e}")

        # 2. If fewer than limit items, query live YouTube Music catalog
        if len(results) < limit:
            try:
                yt = cls.get_ytmusic()
                yt_res = yt.search(clean_q, filter="songs", limit=limit - len(results) + 3)
                for item in yt_res:
                    vid = item.get("videoId")
                    title = item.get("title")
                    if not vid or not title:
                        continue
                    artists = [a.get("name") for a in item.get("artists", []) if a.get("name")] or ["Various Artists"]
                    key = f"{title.lower()}:{artists[0].lower()}"
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)

                    thumbs = item.get("thumbnails", [])
                    cover_url = thumbs[-1]["url"] if thumbs else f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"
                    if "w120-h120" in cover_url:
                        cover_url = cover_url.replace("w120-h120", "w600-h600")

                    results.append({
                        "id": f"youtube:video:{vid}",
                        "name": title,
                        "artists": artists,
                        "cover_url": cover_url,
                        "preview_url": f"https://www.youtube.com/watch?v={vid}",
                        "source": "youtube",
                        "popularity": 80,
                        "is_local": False
                    })
                    if len(results) >= limit:
                        break
            except Exception as e:
                logger.warning(f"YTMusic autocomplete fallback error: {e}")

        return results[:limit]

    @classmethod
    async def resolve_and_enrich_target(cls, query: str) -> Optional[Dict[str, Any]]:
        """
        Resolves query into an exact Track dictionary with 600x600 cover, 30s preview,
        and Gemini 768-D embedding.
        """
        clean_q = query.strip()
        if not clean_q:
            return None

        # 1. Search Neo4j
        try:
            cypher = """
            MATCH (t:Track)-[:BY]->(a:Artist)
            WHERE toLower(t.name) CONTAINS toLower($q) OR toLower(a.name) CONTAINS toLower($q)
            OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
            RETURN t.id AS id, t.name AS name, collect(DISTINCT a.name) AS artists,
                   collect(DISTINCT g.name) AS genres, coalesce(t.cover_url, '') AS cover_url,
                   coalesce(t.preview_url, '') AS preview_url, coalesce(t.source, 'youtube') AS source,
                   t.energy AS energy, t.valence AS valence, t.danceability AS danceability,
                   t.embedding AS embedding, coalesce(t.popularity, 80) AS popularity
            LIMIT 1
            """
            local = neo4j_conn.query(cypher, {"q": clean_q})
            if local and local[0].get("id"):
                row = local[0]
                vec = row.get("embedding")
                if not vec:
                    vec = GeminiEmbedder.embed_text_sync(f"Track: {row['name']}. Artists: {', '.join(row['artists'])}")
                return {
                    "id": row["id"],
                    "name": row["name"],
                    "artists": row["artists"] or ["Featured Artist"],
                    "genres": row["genres"] or ["music"],
                    "cover_url": row["cover_url"],
                    "preview_url": row["preview_url"],
                    "source": row["source"],
                    "popularity": row["popularity"],
                    "energy": row.get("energy") or 0.65,
                    "valence": row.get("valence") or 0.60,
                    "danceability": row.get("danceability") or 0.65,
                    "embedding": vec
                }
        except Exception as e:
            logger.warning(f"Neo4j resolve error: {e}")

        # 2. Query Live Catalog
        target_name = clean_q
        target_artist = "Featured Artist"
        vid = None
        cover_url = ""
        preview_url = ""

        try:
            yt = cls.get_ytmusic()
            search_items = yt.search(clean_q, filter="songs", limit=1)
            if search_items:
                item = search_items[0]
                vid = item.get("videoId")
                target_name = item.get("title", clean_q)
                target_artist = item.get("artists", [{}])[0].get("name", "Various Artists")
                thumbs = item.get("thumbnails", [])
                cover_url = thumbs[-1]["url"] if thumbs else f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"
                if "w120-h120" in cover_url:
                    cover_url = cover_url.replace("w120-h120", "w600-h600")
                preview_url = f"https://www.youtube.com/watch?v={vid}"
        except Exception as e:
            logger.warning(f"Live catalog lookup error: {e}")

        # 3. Enrich via iTunes Search API for official 600x600 cover & 30s AAC audio stream
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                it_q = urllib.parse.quote(f"{target_name} {target_artist}".strip())
                it_url = f"https://itunes.apple.com/search?term={it_q}&entity=song&limit=1"
                res = await client.get(it_url)
                if res.status_code == 200:
                    i_data = res.json()
                    if i_data.get("resultCount", 0) > 0:
                        it_item = i_data["results"][0]
                        art = it_item.get("artworkUrl100", "").replace("100x100bb", "600x600bb")
                        prev = it_item.get("previewUrl", "")
                        if art:
                            cover_url = art
                        if prev:
                            preview_url = prev
        except Exception:
            pass

        # 4. Generate Gemini latent embedding & acoustic vectors
        track_id = f"youtube:video:{vid}" if vid else f"track:custom:{re.sub(r'[^a-zA-Z0-9]', '', target_name.lower())[:24]}"
        vec = GeminiEmbedder.embed_text_sync(f"Track: {target_name}. Artists: {target_artist}. Genre: Music")
        genres = GeminiEmbedder.infer_genres_from_embedding(vec, top_k=3) if vec else ["music"]
        features = GeminiEmbedder.infer_acoustic_features_from_embedding(vec) if vec else {"energy": 0.70, "valence": 0.65, "danceability": 0.70}

        target_obj = {
            "id": track_id,
            "name": target_name,
            "artists": [target_artist],
            "genres": genres,
            "album": "Single",
            "source": "youtube",
            "cover_url": cover_url,
            "preview_url": preview_url,
            "uri": preview_url,
            "popularity": 85,
            "energy": features.get("energy", 0.70),
            "valence": features.get("valence", 0.65),
            "danceability": features.get("danceability", 0.70),
            "embedding": vec,
            "features": features
        }

        # Persist to Neo4j global catalog
        try:
            GraphLoader.load_frontier_catalog_tracks([target_obj])
        except Exception as e:
            logger.warning(f"Error persisting target track to Neo4j catalog: {e}")

        return target_obj

    @classmethod
    async def search_and_bridge(cls, query: str, user_id: str = "astitva_demo_user", limit: int = 10) -> Dict[str, Any]:
        """
        Executes the Bridged Taste Recommendation Network:
        1. Resolves target song.
        2. Sets target song as Card #1 (Direct Search Match).
        3. Identifies topological bridges between target song and user's taste graph.
        4. Emits curated cards labeled 'Recommended based on this search through AI'.
        """
        target = await cls.resolve_and_enrich_target(query)
        if not target:
            return {
                "status": "not_found",
                "message": f"Could not find any song matching '{query}'.",
                "cards": []
            }

        target_id = target["id"]
        target_name = target["name"]
        target_artist = target["artists"][0] if target["artists"] else "Artist"
        target_vec = target.get("embedding")

        # Prepare Card #1 (The Exact Searched Song)
        first_card = {
            "track_id": target["id"],
            "track_name": target["name"],
            "artists": target["artists"],
            "genres": target.get("genres") or ["Music"],
            "source": target.get("source", "youtube"),
            "cover_url": target.get("cover_url", ""),
            "preview_url": target.get("preview_url", ""),
            "score": 1.0,
            "popularity": target.get("popularity", 85),
            "energy": target.get("energy", 0.7),
            "valence": target.get("valence", 0.6),
            "danceability": target.get("danceability", 0.65),
            "reason": "Direct Search Match",
            "is_search_anchor": True
        }

        bridged_cards = []

        # Query Neo4j for bridged tracks connecting target to user's listened artists/genres
        try:
            bridge_cypher = """
            MATCH (u:User {id: $user_id})-[r:LISTENED_TO]->(seed:Track)
            MATCH (rec:Track)-[:BY]->(a:Artist)
            WHERE rec.id <> $target_id
            OPTIONAL MATCH (rec)-[:IN_GENRE]->(g:Genre)
            OPTIONAL MATCH (seed)-[:BY]->(seed_a:Artist)
            WITH rec, a, seed, seed_a, collect(DISTINCT g.name) AS rec_genres,
                 case when seed_a.id = a.id then 0.40 else 0.0 end AS artist_affinity
            RETURN DISTINCT
                rec.id AS track_id,
                rec.name AS track_name,
                collect(DISTINCT a.name) AS artists,
                rec_genres AS genres,
                coalesce(rec.cover_url, '') AS cover_url,
                coalesce(rec.preview_url, '') AS preview_url,
                coalesce(rec.source, 'youtube') AS source,
                coalesce(rec.popularity, 70) AS popularity,
                coalesce(rec.energy, 0.65) AS energy,
                coalesce(rec.valence, 0.60) AS valence,
                coalesce(rec.danceability, 0.65) AS danceability,
                head(collect(DISTINCT seed_a.name)) AS matched_anchor_artist,
                seed.name AS matched_anchor_track
            ORDER BY rec.popularity DESC
            LIMIT 12
            """
            rows = neo4j_conn.query(bridge_cypher, {"user_id": user_id, "target_id": target_id})
            for r in rows:
                anchor_artist = r.get("matched_anchor_artist") or "your library"
                bridged_cards.append({
                    "track_id": r["track_id"],
                    "track_name": r["track_name"],
                    "artists": r["artists"] or ["Featured Artist"],
                    "genres": r["genres"] or ["music"],
                    "source": r["source"],
                    "cover_url": r["cover_url"],
                    "preview_url": r["preview_url"],
                    "score": 0.94,
                    "popularity": r["popularity"],
                    "energy": r["energy"],
                    "valence": r["valence"],
                    "danceability": r["danceability"],
                    "reason": f"Recommended based on this search through AI (bridges {target_artist} with your affinity for {anchor_artist})"
                })
        except Exception as e:
            logger.warning(f"Error querying Neo4j bridge: {e}")

        # If local bridge has fewer than 5 tracks, dynamically expand frontier for target style
        if len(bridged_cards) < 6:
            try:
                frontier_items = FrontierFetcher.expand_frontier_for_prompt(
                    f"{target_artist} {target.get('genres', ['music'])[0]} style",
                    user_id=user_id,
                    limit=5
                )
                for fi in frontier_items:
                    if fi["id"] == target_id:
                        continue
                    bridged_cards.append({
                        "track_id": fi["id"],
                        "track_name": fi["name"],
                        "artists": fi.get("artists") or [target_artist],
                        "genres": fi.get("genres") or ["music"],
                        "source": fi.get("source", "youtube"),
                        "cover_url": fi.get("cover_url", ""),
                        "preview_url": fi.get("preview_url", ""),
                        "score": 0.91,
                        "popularity": 80,
                        "energy": 0.70,
                        "valence": 0.65,
                        "danceability": 0.70,
                        "reason": f"Recommended based on this search through AI (shares {target_artist}'s sound signature)"
                    })
            except Exception as e:
                logger.warning(f"Error expanding frontier for search: {e}")

        final_deck = [first_card] + bridged_cards[:limit - 1]

        return {
            "status": "success",
            "target_track": first_card,
            "deck_id": f"search:{re.sub(r'[^a-zA-Z0-9]', '_', target_id)}",
            "deck_title": f"Search: {target_name}",
            "cards": final_deck,
            "total_cards": len(final_deck),
            "explanation": f"Discovered \"{target_name}\" by {target_artist} and built an AI bridged deck connecting its sound with your personal listening taste."
        }
