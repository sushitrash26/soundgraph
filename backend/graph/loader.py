from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger

class GraphLoader:
    @staticmethod
    def upsert_user(user: Dict[str, Any]) -> None:
        query = """
        MERGE (u:User {id: $id})
        ON CREATE SET u.name = $name, u.source = $source, u.avatar_url = $avatar_url, u.created_at = datetime()
        ON MATCH SET u.name = $name, u.source = $source, u.avatar_url = $avatar_url, u.updated_at = datetime()
        """
        neo4j_conn.query(query, {
            "id": user.get("id"),
            "name": user.get("name", "Music Enthusiast"),
            "source": user.get("source", "spotify"),
            "avatar_url": user.get("avatar_url", "")
        })

    @staticmethod
    def load_tracks_batch(user_id: str, tracks: List[Dict[str, Any]]) -> int:
        query = """
        UNWIND $batch AS item
        // 1. Merge Track
        MERGE (t:Track {id: item.id})
        ON CREATE SET 
            t.name = item.name,
            t.source = item.source,
            t.uri = item.uri,
            t.duration_ms = item.duration_ms,
            t.popularity = item.popularity,
            t.energy = item.energy,
            t.valence = item.valence,
            t.danceability = item.danceability,
            t.tempo = item.tempo,
            t.acousticness = item.acousticness,
            t.instrumentalness = item.instrumentalness,
            t.embedding = item.embedding,
            t.created_at = datetime()
        ON MATCH SET
            t.energy = coalesce(item.energy, t.energy),
            t.valence = coalesce(item.valence, t.valence),
            t.danceability = coalesce(item.danceability, t.danceability),
            t.popularity = coalesce(item.popularity, t.popularity),
            t.embedding = coalesce(item.embedding, t.embedding)

        // 2. User LISTENED_TO Track
        WITH t, item
        MATCH (u:User {id: $user_id})
        MERGE (u)-[r:LISTENED_TO]->(t)
        ON CREATE SET r.play_count = coalesce(item.play_count, 1), r.last_played = datetime(), r.source = item.source
        ON MATCH SET r.play_count = r.play_count + coalesce(item.play_count, 1), r.last_played = datetime()

        // 3. Connect Artists
        WITH t, item
        FOREACH (artist_name IN item.artists |
            MERGE (a:Artist {id: 'artist:' + toLower(trim(artist_name))})
            ON CREATE SET a.name = artist_name, a.source = item.source
            MERGE (t)-[:BY]->(a)
        )

        // 4. Connect Genres
        WITH t, item
        FOREACH (genre_name IN item.genres |
            MERGE (g:Genre {name: toLower(trim(genre_name))})
            MERGE (t)-[:IN_GENRE]->(g)
            FOREACH (artist_name IN item.artists |
                MERGE (a:Artist {id: 'artist:' + toLower(trim(artist_name))})
                MERGE (a)-[:IN_GENRE]->(g)
            )
        )

        // 5. Connect Album if present
        WITH t, item
        FOREACH (_ IN CASE WHEN item.album IS NOT NULL AND item.album <> '' THEN [1] ELSE [] END |
            MERGE (al:Album {id: 'album:' + toLower(trim(item.album))})
            ON CREATE SET al.name = item.album
            MERGE (t)-[:IN_ALBUM]->(al)
        )
        RETURN count(t) as processed
        """
        # Clean payload items
        cleaned_batch = []
        for tr in tracks:
            features = tr.get("features") or {}
            cleaned_batch.append({
                "id": str(tr.get("id")),
                "name": str(tr.get("name")),
                "source": str(tr.get("source", "spotify")),
                "uri": tr.get("uri") or "",
                "duration_ms": tr.get("duration_ms") or 0,
                "popularity": tr.get("popularity") or 50,
                "play_count": tr.get("play_count") or 1,
                "artists": tr.get("artists") or [],
                "genres": tr.get("genres") or [],
                "album": tr.get("album") or "",
                "energy": features.get("energy") or tr.get("energy"),
                "valence": features.get("valence") or tr.get("valence"),
                "danceability": features.get("danceability") or tr.get("danceability"),
                "tempo": features.get("tempo") or tr.get("tempo"),
                "acousticness": features.get("acousticness") or tr.get("acousticness"),
                "instrumentalness": features.get("instrumentalness") or tr.get("instrumentalness"),
                "embedding": None,
            })

        # Automatically generate Gemini vector embeddings for every track
        try:
            from backend.embeddings.gemini_embedder import GeminiEmbedder
            embeddings_map = GeminiEmbedder.embed_tracks_batch_sync(cleaned_batch)
            for item in cleaned_batch:
                item["embedding"] = embeddings_map.get(item["id"])
            logger.info(f"Generated {len(embeddings_map)} Gemini embeddings for loaded tracks.")
        except Exception as e:
            logger.warning(f"Embedding generation error during batch load: {e}")

        result = neo4j_conn.query(query, {"user_id": user_id, "batch": cleaned_batch})
        processed = result[0]["processed"] if result else len(cleaned_batch)
        logger.info(f"Loaded batch of {processed} tracks for user {user_id}")
        return processed

    @staticmethod
    def load_frontier_catalog_tracks(tracks: List[Dict[str, Any]]) -> int:
        """
        Loads candidate tracks discovered via FrontierFetcher into the global catalog.
        Creates (t:Track), connects (a:Artist) and (g:Genre), and sets 768-D vector embedding.
        Does NOT attach user LISTENED_TO edge.
        """
        query = """
        UNWIND $batch AS item
        MERGE (t:Track {id: item.id})
        ON CREATE SET 
            t.name = item.name,
            t.source = item.source,
            t.uri = item.uri,
            t.popularity = item.popularity,
            t.energy = item.energy,
            t.valence = item.valence,
            t.danceability = item.danceability,
            t.embedding = item.embedding,
            t.created_at = datetime()
        ON MATCH SET
            t.embedding = coalesce(item.embedding, t.embedding),
            t.popularity = coalesce(item.popularity, t.popularity)

        // Connect Artists
        WITH t, item
        FOREACH (artist_name IN item.artists |
            MERGE (a:Artist {id: 'artist:' + toLower(trim(artist_name))})
            ON CREATE SET a.name = artist_name, a.source = item.source
            MERGE (t)-[:BY]->(a)
        )

        // Connect Genres
        WITH t, item
        FOREACH (genre_name IN item.genres |
            MERGE (g:Genre {name: toLower(trim(genre_name))})
            MERGE (t)-[:IN_GENRE]->(g)
        )
        RETURN count(t) as processed
        """
        cleaned_batch = []
        for tr in tracks:
            features = tr.get("features") or {}
            cleaned_batch.append({
                "id": tr["id"],
                "name": tr.get("name") or tr.get("title") or "Unknown Track",
                "source": tr.get("source", "youtube"),
                "uri": tr.get("uri") or f"https://music.youtube.com/watch?v={tr['id'].replace('youtube:video:', '')}",
                "popularity": tr.get("popularity", 75),
                "energy": features.get("energy", 0.65),
                "valence": features.get("valence", 0.55),
                "danceability": features.get("danceability", 0.60),
                "artists": tr.get("artists") or ["Artist"],
                "genres": tr.get("genres") or ["discovery"],
                "embedding": tr.get("embedding")
            })
        try:
            res = neo4j_conn.query(query, {"batch": cleaned_batch})
            return res[0]["processed"] if res else 0
        except Exception as e:
            logger.error(f"Error loading frontier catalog tracks: {e}")
            return 0

    @staticmethod
    def seed_mock_dataset(user_id: str = "demo_user") -> Dict[str, Any]:
        """Seeds realistic cross-platform listening history for instant testing/demo"""
        GraphLoader.upsert_user({
            "id": user_id,
            "name": "Astitva Pathak",
            "source": "merged",
            "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
        })

        tracks = [
            # Electronic / Synthwave / Cyberpunk (Spotify & YouTube)
            {
                "id": "spotify:track:midnight_city",
                "name": "Midnight City",
                "artists": ["M83"],
                "album": "Hurry Up, We're Dreaming",
                "genres": ["synthpop", "electronic", "dream pop"],
                "source": "spotify",
                "popularity": 85,
                "play_count": 28,
                "features": {"energy": 0.78, "valence": 0.55, "danceability": 0.62, "tempo": 105.0, "acousticness": 0.05, "instrumentalness": 0.12}
            },
            {
                "id": "spotify:track:starboy",
                "name": "Starboy",
                "artists": ["The Weeknd", "Daft Punk"],
                "album": "Starboy",
                "genres": ["r&b", "electropop", "pop"],
                "source": "spotify",
                "popularity": 92,
                "play_count": 35,
                "features": {"energy": 0.82, "valence": 0.68, "danceability": 0.75, "tempo": 120.0, "acousticness": 0.14, "instrumentalness": 0.0}
            },
            {
                "id": "youtube:video:get_lucky",
                "name": "Get Lucky",
                "artists": ["Daft Punk", "Pharrell Williams"],
                "album": "Random Access Memories",
                "genres": ["disco", "funk", "electronic"],
                "source": "youtube",
                "popularity": 89,
                "play_count": 22,
                "features": {"energy": 0.81, "valence": 0.86, "danceability": 0.79, "tempo": 116.0, "acousticness": 0.04, "instrumentalness": 0.0}
            },
            {
                "id": "spotify:track:instant_crush",
                "name": "Instant Crush",
                "artists": ["Daft Punk", "Julian Casablancas"],
                "album": "Random Access Memories",
                "genres": ["electronic", "synthpop", "indie pop"],
                "source": "spotify",
                "popularity": 81,
                "play_count": 19,
                "features": {"energy": 0.76, "valence": 0.58, "danceability": 0.65, "tempo": 110.0, "acousticness": 0.08, "instrumentalness": 0.02}
            },
            {
                "id": "youtube:video:harder_better",
                "name": "Harder, Better, Faster, Stronger",
                "artists": ["Daft Punk"],
                "album": "Discovery",
                "genres": ["electronic", "house", "french touch"],
                "source": "youtube",
                "popularity": 87,
                "play_count": 30,
                "features": {"energy": 0.90, "valence": 0.71, "danceability": 0.81, "tempo": 123.0, "acousticness": 0.03, "instrumentalness": 0.15}
            },
            # Indie Rock & Alternative
            {
                "id": "spotify:track:do_i_wanna_know",
                "name": "Do I Wanna Know?",
                "artists": ["Arctic Monkeys"],
                "album": "AM",
                "genres": ["indie rock", "garage rock", "rock"],
                "source": "spotify",
                "popularity": 90,
                "play_count": 42,
                "features": {"energy": 0.56, "valence": 0.41, "danceability": 0.55, "tempo": 85.0, "acousticness": 0.18, "instrumentalness": 0.0}
            },
            {
                "id": "youtube:video:r_u_mine",
                "name": "R U Mine?",
                "artists": ["Arctic Monkeys"],
                "album": "AM",
                "genres": ["indie rock", "rock", "garage rock"],
                "source": "youtube",
                "popularity": 84,
                "play_count": 25,
                "features": {"energy": 0.88, "valence": 0.52, "danceability": 0.44, "tempo": 97.0, "acousticness": 0.01, "instrumentalness": 0.0}
            },
            {
                "id": "spotify:track:the_less_i_know",
                "name": "The Less I Know The Better",
                "artists": ["Tame Impala"],
                "album": "Currents",
                "genres": ["psychedelic rock", "indie pop", "synthpop"],
                "source": "spotify",
                "popularity": 88,
                "play_count": 37,
                "features": {"energy": 0.74, "valence": 0.78, "danceability": 0.64, "tempo": 117.0, "acousticness": 0.11, "instrumentalness": 0.01}
            },
            {
                "id": "youtube:video:borderline",
                "name": "Borderline",
                "artists": ["Tame Impala"],
                "album": "The Slow Rush",
                "genres": ["psychedelic rock", "synthpop", "indie rock"],
                "source": "youtube",
                "popularity": 80,
                "play_count": 18,
                "features": {"energy": 0.73, "valence": 0.63, "danceability": 0.67, "tempo": 122.0, "acousticness": 0.16, "instrumentalness": 0.03}
            },
            {
                "id": "spotify:track:let_it_happen",
                "name": "Let It Happen",
                "artists": ["Tame Impala"],
                "album": "Currents",
                "genres": ["psychedelic rock", "electronic", "indie rock"],
                "source": "spotify",
                "popularity": 82,
                "play_count": 24,
                "features": {"energy": 0.87, "valence": 0.45, "danceability": 0.60, "tempo": 125.0, "acousticness": 0.05, "instrumentalness": 0.09}
            },
            # Hip-Hop & Rap
            {
                "id": "spotify:track:humble",
                "name": "HUMBLE.",
                "artists": ["Kendrick Lamar"],
                "album": "DAMN.",
                "genres": ["hip-hop", "rap", "conscious rap"],
                "source": "spotify",
                "popularity": 89,
                "play_count": 31,
                "features": {"energy": 0.62, "valence": 0.42, "danceability": 0.90, "tempo": 150.0, "acousticness": 0.00, "instrumentalness": 0.0}
            },
            {
                "id": "youtube:video:all_the_stars",
                "name": "All The Stars",
                "artists": ["Kendrick Lamar", "SZA"],
                "album": "Black Panther",
                "genres": ["hip-hop", "r&b", "pop"],
                "source": "youtube",
                "popularity": 87,
                "play_count": 27,
                "features": {"energy": 0.63, "valence": 0.55, "danceability": 0.69, "tempo": 97.0, "acousticness": 0.06, "instrumentalness": 0.0}
            },
            {
                "id": "spotify:track:snooze",
                "name": "Snooze",
                "artists": ["SZA"],
                "album": "SOS",
                "genres": ["r&b", "neo soul", "pop"],
                "source": "spotify",
                "popularity": 91,
                "play_count": 34,
                "features": {"energy": 0.55, "valence": 0.39, "danceability": 0.56, "tempo": 143.0, "acousticness": 0.14, "instrumentalness": 0.0}
            },
            {
                "id": "youtube:video:kill_bill",
                "name": "Kill Bill",
                "artists": ["SZA"],
                "album": "SOS",
                "genres": ["r&b", "pop"],
                "source": "youtube",
                "popularity": 93,
                "play_count": 40,
                "features": {"energy": 0.73, "valence": 0.84, "danceability": 0.64, "tempo": 89.0, "acousticness": 0.05, "instrumentalness": 0.14}
            },
            # Pop & Ambient / Bollywood Fusion
            {
                "id": "spotify:track:as_it_was",
                "name": "As It Was",
                "artists": ["Harry Styles"],
                "album": "Harry's House",
                "genres": ["pop", "synthpop", "indie pop"],
                "source": "spotify",
                "popularity": 94,
                "play_count": 45,
                "features": {"energy": 0.73, "valence": 0.66, "danceability": 0.52, "tempo": 174.0, "acousticness": 0.34, "instrumentalness": 0.0}
            },
            {
                "id": "youtube:video:apna_bana_le",
                "name": "Apna Bana Le",
                "artists": ["Arijit Singh", "Sachin-Jigar"],
                "album": "Bhediya",
                "genres": ["bollywood", "romantic", "indian pop"],
                "source": "youtube",
                "popularity": 86,
                "play_count": 38,
                "features": {"energy": 0.52, "valence": 0.44, "danceability": 0.50, "tempo": 95.0, "acousticness": 0.65, "instrumentalness": 0.0}
            },
            {
                "id": "spotify:track:kesariya",
                "name": "Kesariya",
                "artists": ["Arijit Singh", "Pritam"],
                "album": "Brahmastra",
                "genres": ["bollywood", "indian pop"],
                "source": "spotify",
                "popularity": 88,
                "play_count": 36,
                "features": {"energy": 0.58, "valence": 0.49, "danceability": 0.57, "tempo": 98.0, "acousticness": 0.43, "instrumentalness": 0.0}
            },
            {
                "id": "youtube:video:tum_hi_ho",
                "name": "Tum Hi Ho",
                "artists": ["Arijit Singh", "Mithoon"],
                "album": "Aashiqui 2",
                "genres": ["bollywood", "romantic"],
                "source": "youtube",
                "popularity": 84,
                "play_count": 29,
                "features": {"energy": 0.48, "valence": 0.32, "danceability": 0.45, "tempo": 92.0, "acousticness": 0.70, "instrumentalness": 0.0}
            }
        ]

        count = GraphLoader.load_tracks_batch(user_id, tracks[:10])

        # Candidate Discovery Catalog Tracks (Available in graph but not yet listened to by this user)
        candidate_tracks = [
            {
                "id": "spotify:track:one_more_time",
                "name": "One More Time",
                "artists": ["Daft Punk"],
                "album": "Discovery",
                "genres": ["electronic", "house", "french touch"],
                "source": "spotify",
                "popularity": 88,
                "features": {"energy": 0.85, "valence": 0.75, "danceability": 0.82, "tempo": 123.0, "acousticness": 0.04, "instrumentalness": 0.05}
            },
            {
                "id": "youtube:video:nightcall",
                "name": "Nightcall",
                "artists": ["Kavinsky"],
                "album": "OutRun",
                "genres": ["synthwave", "electronic", "french touch"],
                "source": "youtube",
                "popularity": 85,
                "features": {"energy": 0.72, "valence": 0.45, "danceability": 0.58, "tempo": 105.0, "acousticness": 0.08, "instrumentalness": 0.20}
            },
            {
                "id": "spotify:track:blinding_lights",
                "name": "Blinding Lights",
                "artists": ["The Weeknd"],
                "album": "After Hours",
                "genres": ["synthpop", "r&b", "pop"],
                "source": "spotify",
                "popularity": 96,
                "features": {"energy": 0.80, "valence": 0.61, "danceability": 0.70, "tempo": 171.0, "acousticness": 0.00, "instrumentalness": 0.0}
            },
            {
                "id": "spotify:track:around_the_world",
                "name": "Around The World",
                "artists": ["Daft Punk"],
                "album": "Homework",
                "genres": ["electronic", "house"],
                "source": "spotify",
                "popularity": 82,
                "features": {"energy": 0.88, "valence": 0.70, "danceability": 0.85, "tempo": 121.0, "acousticness": 0.01, "instrumentalness": 0.80}
            },
            {
                "id": "youtube:video:genesis_justice",
                "name": "Genesis",
                "artists": ["Justice"],
                "album": "Cross",
                "genres": ["electronic", "french touch", "dance"],
                "source": "youtube",
                "popularity": 79,
                "features": {"energy": 0.92, "valence": 0.50, "danceability": 0.60, "tempo": 117.0, "acousticness": 0.02, "instrumentalness": 0.40}
            },
            {
                "id": "spotify:track:lost_in_yesterday",
                "name": "Lost In Yesterday",
                "artists": ["Tame Impala"],
                "album": "The Slow Rush",
                "genres": ["psychedelic rock", "indie pop", "synthpop"],
                "source": "spotify",
                "popularity": 83,
                "features": {"energy": 0.78, "valence": 0.80, "danceability": 0.68, "tempo": 124.0, "acousticness": 0.10, "instrumentalness": 0.02}
            },
            {
                "id": "youtube:video:505",
                "name": "505",
                "artists": ["Arctic Monkeys"],
                "album": "Favourite Worst Nightmare",
                "genres": ["indie rock", "garage rock", "rock"],
                "source": "youtube",
                "popularity": 92,
                "features": {"energy": 0.85, "valence": 0.35, "danceability": 0.45, "tempo": 140.0, "acousticness": 0.03, "instrumentalness": 0.0}
            },
            {
                "id": "spotify:track:money_trees",
                "name": "Money Trees",
                "artists": ["Kendrick Lamar"],
                "album": "good kid, m.A.A.d city",
                "genres": ["hip-hop", "rap", "conscious rap"],
                "source": "spotify",
                "popularity": 91,
                "features": {"energy": 0.69, "valence": 0.40, "danceability": 0.72, "tempo": 72.0, "acousticness": 0.07, "instrumentalness": 0.0}
            },
            {
                "id": "youtube:video:chaleya",
                "name": "Chaleya",
                "artists": ["Arijit Singh", "Shilpa Rao"],
                "album": "Jawan",
                "genres": ["bollywood", "romantic", "indian pop"],
                "source": "youtube",
                "popularity": 89,
                "features": {"energy": 0.65, "valence": 0.75, "danceability": 0.70, "tempo": 105.0, "acousticness": 0.25, "instrumentalness": 0.0}
            },
            {
                "id": "spotify:track:raabta",
                "name": "Raabta",
                "artists": ["Arijit Singh", "Pritam"],
                "album": "Agent Vinod",
                "genres": ["bollywood", "romantic"],
                "source": "spotify",
                "popularity": 81,
                "features": {"energy": 0.54, "valence": 0.42, "danceability": 0.58, "tempo": 96.0, "acousticness": 0.55, "instrumentalness": 0.0}
            }
        ]
        cat_count = GraphLoader.load_catalog_tracks(candidate_tracks)

        return {
            "status": "success",
            "user_id": user_id,
            "tracks_listened": count,
            "catalog_candidates_loaded": cat_count,
            "total_tracks": count + cat_count,
            "sources": ["spotify", "youtube"]
        }

    @staticmethod
    def load_catalog_tracks(tracks: List[Dict[str, Any]]) -> int:
        """Loads catalog tracks into the graph without binding them to a specific user as LISTENED_TO"""
        query = """
        UNWIND $batch AS item
        MERGE (t:Track {id: item.id})
        ON CREATE SET 
            t.name = item.name,
            t.source = item.source,
            t.uri = item.uri,
            t.popularity = item.popularity,
            t.energy = item.energy,
            t.valence = item.valence,
            t.danceability = item.danceability,
            t.tempo = item.tempo,
            t.acousticness = item.acousticness,
            t.instrumentalness = item.instrumentalness,
            t.created_at = datetime()

        WITH t, item
        FOREACH (artist_name IN item.artists |
            MERGE (a:Artist {id: 'artist:' + toLower(trim(artist_name))})
            ON CREATE SET a.name = artist_name, a.source = item.source
            MERGE (t)-[:BY]->(a)
        )

        WITH t, item
        FOREACH (genre_name IN item.genres |
            MERGE (g:Genre {name: toLower(trim(genre_name))})
            MERGE (t)-[:IN_GENRE]->(g)
            FOREACH (artist_name IN item.artists |
                MERGE (a:Artist {id: 'artist:' + toLower(trim(artist_name))})
                MERGE (a)-[:IN_GENRE]->(g)
            )
        )

        WITH t, item
        FOREACH (_ IN CASE WHEN item.album IS NOT NULL AND item.album <> '' THEN [1] ELSE [] END |
            MERGE (al:Album {id: 'album:' + toLower(trim(item.album))})
            ON CREATE SET al.name = item.album
            MERGE (t)-[:IN_ALBUM]->(al)
        )
        RETURN count(t) as processed
        """
        cleaned_batch = []
        for tr in tracks:
            features = tr.get("features") or {}
            cleaned_batch.append({
                "id": str(tr.get("id")),
                "name": str(tr.get("name")),
                "source": str(tr.get("source", "spotify")),
                "uri": tr.get("uri") or "",
                "popularity": tr.get("popularity") or 75,
                "artists": tr.get("artists") or [],
                "genres": tr.get("genres") or [],
                "album": tr.get("album") or "",
                "energy": features.get("energy") or tr.get("energy"),
                "valence": features.get("valence") or tr.get("valence"),
                "danceability": features.get("danceability") or tr.get("danceability"),
                "tempo": features.get("tempo") or tr.get("tempo"),
                "acousticness": features.get("acousticness") or tr.get("acousticness"),
                "instrumentalness": features.get("instrumentalness") or tr.get("instrumentalness"),
            })
        result = neo4j_conn.query(query, {"batch": cleaned_batch})
        return result[0]["processed"] if result else len(cleaned_batch)

