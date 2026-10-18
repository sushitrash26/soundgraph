import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.core.logger import logger
from backend.core.neo4j_driver import neo4j_conn

class DeckService:
    """
    Personalized User Deck Service:
    Manages custom decks created by users, saved from AI chat, or generated from search.
    Persists to Neo4j (:User)-[:CREATED]->(:Deck)-[:CONTAINS]->(:Track).
    """

    @classmethod
    def list_user_decks(cls, user_id: str = "astitva_demo_user") -> List[Dict[str, Any]]:
        query = """
        MATCH (u:User {id: $user_id})-[:CREATED]->(d:Deck)
        OPTIONAL MATCH (d)-[r:CONTAINS]->(t:Track)
        WITH d, count(DISTINCT t) AS track_count, collect(DISTINCT t.cover_url)[0..4] AS sample_covers
        RETURN d.id AS id, d.name AS name, coalesce(d.mood, 'general') AS mood,
               coalesce(d.cover_url, '') AS cover_url, track_count, sample_covers,
               d.created_at AS created_at
        ORDER BY d.created_at DESC
        """
        try:
            rows = neo4j_conn.query(query, {"user_id": user_id})
            decks = []
            for r in rows:
                cover = r.get("cover_url")
                if not cover and r.get("sample_covers"):
                    covers = [c for c in r.get("sample_covers") if c]
                    cover = covers[0] if covers else ""
                decks.append({
                    "id": r["id"],
                    "name": r["name"],
                    "mood": r["mood"],
                    "cover_url": cover,
                    "track_count": r["track_count"],
                    "sample_covers": r.get("sample_covers", []),
                    "created_at": str(r.get("created_at", ""))
                })
            return decks
        except Exception as e:
            logger.error(f"Error listing decks for user {user_id}: {e}")
            return []

    @classmethod
    def create_deck(
        cls,
        user_id: str,
        name: str,
        mood: str = "general",
        track_ids: Optional[List[str]] = None,
        cover_url: str = ""
    ) -> Dict[str, Any]:
        deck_id = f"deck_{uuid.uuid4().hex[:12]}"
        clean_name = name.strip() or "Untitled Deck"
        tracks = track_ids or []

        create_q = """
        MATCH (u:User {id: $user_id})
        MERGE (d:Deck {id: $deck_id})
        ON CREATE SET d.name = $name, d.mood = $mood, d.cover_url = $cover_url, d.created_at = datetime()
        MERGE (u)-[:CREATED]->(d)
        WITH d
        UNWIND range(0, size($track_ids) - 1) AS idx
        WITH d, idx, $track_ids[idx] AS tid
        MATCH (t:Track {id: tid})
        MERGE (d)-[r:CONTAINS]->(t)
        ON CREATE SET r.position = idx, r.added_at = datetime()
        RETURN d.id AS id, d.name AS name
        """
        try:
            # Also ensure user exists
            neo4j_conn.query("MERGE (u:User {id: $user_id})", {"user_id": user_id})
            neo4j_conn.query(create_q, {
                "user_id": user_id,
                "deck_id": deck_id,
                "name": clean_name,
                "mood": mood,
                "cover_url": cover_url,
                "track_ids": tracks
            })
            logger.info(f"Created deck '{clean_name}' ({deck_id}) with {len(tracks)} tracks for user {user_id}")
            return {
                "id": deck_id,
                "name": clean_name,
                "mood": mood,
                "cover_url": cover_url,
                "track_count": len(tracks)
            }
        except Exception as e:
            logger.error(f"Error creating deck: {e}")
            return {"id": deck_id, "name": clean_name, "track_count": 0}

    @classmethod
    def get_deck_cards(cls, deck_id: str, user_id: str = "astitva_demo_user") -> Dict[str, Any]:
        """Loads cards for swiping and playing on dashboard."""
        deck_meta_q = "MATCH (d:Deck {id: $deck_id}) RETURN d.id AS id, d.name AS name, d.mood AS mood, d.cover_url AS cover_url"
        meta_res = neo4j_conn.query(deck_meta_q, {"deck_id": deck_id})
        if not meta_res:
            return {"deck_id": deck_id, "name": "Deck", "cards": []}

        meta = meta_res[0]

        cards_q = """
        MATCH (d:Deck {id: $deck_id})-[r:CONTAINS]->(t:Track)
        OPTIONAL MATCH (t)-[:BY]->(a:Artist)
        OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
        RETURN t.id AS track_id, t.name AS track_name,
               collect(DISTINCT a.name) AS artists,
               collect(DISTINCT g.name) AS genres,
               coalesce(t.cover_url, '') AS cover_url,
               coalesce(t.preview_url, '') AS preview_url,
               coalesce(t.source, 'youtube') AS source,
               coalesce(t.popularity, 80) AS popularity,
               coalesce(t.energy, 0.65) AS energy,
               coalesce(t.valence, 0.60) AS valence,
               coalesce(t.danceability, 0.65) AS danceability,
               r.position AS position,
               'Added to ' + d.name AS reason
        ORDER BY r.position ASC
        """
        rows = neo4j_conn.query(cards_q, {"deck_id": deck_id})
        cards = []
        for r in rows:
            cards.append({
                "track_id": r["track_id"],
                "track_name": r["track_name"],
                "artists": r["artists"] or ["Featured Artist"],
                "genres": r["genres"] or ["music"],
                "source": r["source"],
                "cover_url": r["cover_url"],
                "preview_url": r["preview_url"],
                "score": 0.99,
                "popularity": r["popularity"],
                "energy": r["energy"],
                "valence": r["valence"],
                "danceability": r["danceability"],
                "reason": r["reason"]
            })

        return {
            "deck_id": meta["id"],
            "deck_title": meta["name"],
            "mood": meta.get("mood", "general"),
            "cover_url": meta.get("cover_url", ""),
            "cards": cards,
            "total_cards": len(cards)
        }

    @classmethod
    def add_track_to_deck(cls, deck_id: str, track_id: str) -> bool:
        add_q = """
        MATCH (d:Deck {id: $deck_id})
        MATCH (t:Track {id: $track_id})
        MERGE (d)-[r:CONTAINS]->(t)
        ON CREATE SET r.added_at = datetime()
        RETURN d.id
        """
        try:
            res = neo4j_conn.query(add_q, {"deck_id": deck_id, "track_id": track_id})
            return bool(res)
        except Exception as e:
            logger.error(f"Error adding track {track_id} to deck {deck_id}: {e}")
            return False

    @classmethod
    def remove_track_from_deck(cls, deck_id: str, track_id: str) -> bool:
        del_q = """
        MATCH (d:Deck {id: $deck_id})-[r:CONTAINS]->(t:Track {id: $track_id})
        DELETE r
        RETURN d.id
        """
        try:
            res = neo4j_conn.query(del_q, {"deck_id": deck_id, "track_id": track_id})
            return bool(res)
        except Exception as e:
            logger.error(f"Error removing track {track_id} from deck {deck_id}: {e}")
            return False

    @classmethod
    def delete_deck(cls, deck_id: str, user_id: str = "astitva_demo_user") -> bool:
        del_deck_q = """
        MATCH (u:User {id: $user_id})-[:CREATED]->(d:Deck {id: $deck_id})
        DETACH DELETE d
        RETURN count(d) AS deleted
        """
        try:
            res = neo4j_conn.query(del_deck_q, {"deck_id": deck_id, "user_id": user_id})
            return bool(res and res[0].get("deleted", 0) > 0)
        except Exception as e:
            logger.error(f"Error deleting deck {deck_id}: {e}")
            return False
