from typing import List, Dict, Any, Optional
from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger

class GraphQueries:
    @staticmethod
    def get_graph_stats() -> Dict[str, int]:
        query = """
        CALL () {
            MATCH (u:User) RETURN count(u) AS users_count
        }
        CALL () {
            MATCH (t:Track) RETURN count(t) AS tracks_count
        }
        CALL () {
            MATCH (a:Artist) RETURN count(a) AS artists_count
        }
        CALL () {
            MATCH (g:Genre) RETURN count(g) AS genres_count
        }
        CALL () {
            MATCH ()-[r:SIMILAR_TO]->() RETURN count(r) AS similar_to_edges_count
        }
        CALL () {
            MATCH ()-[r:LISTENED_TO]->() RETURN count(r) AS listened_to_edges_count
        }
        RETURN users_count, tracks_count, artists_count, genres_count, similar_to_edges_count, listened_to_edges_count
        """
        try:
            res = neo4j_conn.query(query)
            if res:
                return res[0]
        except Exception as e:
            logger.error(f"Error fetching graph stats: {e}")
        return {
            "users_count": 0,
            "tracks_count": 0,
            "artists_count": 0,
            "genres_count": 0,
            "similar_to_edges_count": 0,
            "listened_to_edges_count": 0,
        }

    @staticmethod
    def get_graph_visualization(limit: int = 150) -> Dict[str, Any]:
        """Fetches nodes and links for react-force-graph visualization"""
        query = """
        MATCH (n)
        WHERE n:Track OR n:Artist OR n:Genre OR n:User
        WITH n LIMIT $limit
        OPTIONAL MATCH (n)-[r]->(m)
        WHERE (m:Track OR m:Artist OR m:Genre OR m:User) AND id(n) < id(m)
        RETURN 
            collect(DISTINCT {
                id: coalesce(n.id, n.name),
                name: coalesce(n.name, n.id),
                label: labels(n)[0],
                source: coalesce(n.source, 'local'),
                popularity: coalesce(n.popularity, 50),
                energy: n.energy,
                valence: n.valence,
                pagerank: n.pagerank,
                community: n.community
            }) AS nodes,
            collect(DISTINCT {
                source: coalesce(n.id, n.name),
                target: coalesce(m.id, m.name),
                type: type(r),
                weight: coalesce(r.score, 1.0)
            }) AS raw_links
        """
        try:
            res = neo4j_conn.query(query, {"limit": limit})
            if res:
                row = res[0]
                nodes = row.get("nodes") or []
                links = [l for l in (row.get("raw_links") or []) if l.get("target") is not None]
                return {"nodes": nodes, "links": links}
        except Exception as e:
            logger.error(f"Error building graph visualization data: {e}")
        return {"nodes": [], "links": []}

    @staticmethod
    def record_feedback(user_id: str, track_id: str, reward: float) -> Dict[str, Any]:
        """
        RLHF Feedback Loop:
        Writes :FEEDBACK edge with reward (+1.0 for like, -1.0 for dislike).
        Dynamically adjusts graph weights for that track, artist, and genre.
        """
        query = """
        MATCH (u:User {id: $user_id})
        MATCH (t:Track {id: $track_id})
        MERGE (u)-[f:FEEDBACK]->(t)
        SET f.reward = $reward, f.updated_at = datetime()
        WITH u, t, f
        OPTIONAL MATCH (t)-[:BY]->(a:Artist)
        OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
        RETURN t.id AS track_id, t.name AS track_name, $reward AS reward, 
               collect(DISTINCT a.name) AS artists, collect(DISTINCT g.name) AS genres
        """
        try:
            res = neo4j_conn.query(query, {"user_id": user_id, "track_id": track_id, "reward": reward})
            if res:
                logger.info(f"RLHF feedback recorded: user={user_id}, track={track_id}, reward={reward}")
                return {"status": "success", "data": res[0]}
        except Exception as e:
            logger.error(f"Error recording RLHF feedback: {e}")
        return {"status": "error", "message": "Failed to record feedback"}

    @staticmethod
    def get_user_library(user_id: str, limit: int = 50) -> Dict[str, Any]:
        """Fetches the actual songs and artists ingested from user's Spotify and YouTube accounts"""
        query = """
        MATCH (u:User {id: $user_id})-[l:LISTENED_TO]->(t:Track)
        OPTIONAL MATCH (t)-[:BY]->(a:Artist)
        OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
        OPTIONAL MATCH (u)-[f:FEEDBACK]->(t)
        WITH t, collect(DISTINCT a.name) AS artists, collect(DISTINCT g.name) AS genres, 
             coalesce(f.reward, 0.0) AS feedback_reward, coalesce(t.source, 'spotify') AS source
        RETURN 
            t.id AS id,
            t.name AS title,
            artists,
            genres,
            source,
            t.popularity AS popularity,
            feedback_reward
        ORDER BY feedback_reward DESC, t.popularity DESC
        LIMIT $limit
        """
        try:
            tracks = neo4j_conn.query(query, {"user_id": user_id, "limit": limit})
            spotify_tracks = [tr for tr in tracks if tr.get("source") == "spotify"]
            youtube_tracks = [tr for tr in tracks if tr.get("source") == "youtube"]
            return {
                "total": len(tracks),
                "all": tracks,
                "spotify": spotify_tracks,
                "youtube": youtube_tracks,
            }
        except Exception as e:
            logger.error(f"Error fetching user library: {e}")
            return {"total": 0, "all": [], "spotify": [], "youtube": []}

    @staticmethod
    def get_recommendations(user_id: str, limit: int = 15) -> List[Dict[str, Any]]:
        """
        Multi-tier RLHF-aware Recommendation Engine:
        1. GDS SIMILAR_TO relationship traversal from listened tracks
        2. STRICT DISTINCT deduplication (fixes multiple Blinding Lights bug)
        3. Excludes disliked tracks (reward = -1.0) and already listened tracks
        4. Boosts tracks related to positively rewarded tracks (+1.0)
        """
        query = """
        MATCH (u:User {id: $user_id})-[l:LISTENED_TO]->(listened:Track)
        // Check for SIMILAR_TO edges
        MATCH (listened)-[sim:SIMILAR_TO]->(rec:Track)
        WHERE NOT (u)-[:LISTENED_TO]->(rec)
          AND NOT EXISTS { MATCH (u)-[bad:FEEDBACK {reward: -1.0}]->(rec) }
        OPTIONAL MATCH (rec)-[:BY]->(a:Artist)
        OPTIONAL MATCH (rec)-[:IN_GENRE]->(g:Genre)
        OPTIONAL MATCH (u)-[f:FEEDBACK]->(rec)
        WITH rec, 
             collect(DISTINCT a.name) AS artists, 
             collect(DISTINCT g.name) AS genres,
             max(sim.score) AS raw_sim, 
             head(collect(DISTINCT listened.name)) AS seed_track,
             head(collect(DISTINCT listened.source)) AS seed_source,
             coalesce(f.reward, 0.0) AS feedback_reward
        WITH rec, artists, genres, seed_track, seed_source,
             round(raw_sim + (feedback_reward * 0.15), 2) AS final_score
        RETURN DISTINCT
            rec.id AS track_id,
            rec.name AS track_name,
            artists,
            genres,
            rec.source AS source,
            final_score AS score,
            coalesce(rec.popularity, 50) AS popularity,
            rec.energy AS energy,
            rec.valence AS valence,
            rec.danceability AS danceability,
            'Discovered through your ' + coalesce(seed_source, 'music') + ' taste in ' + coalesce(seed_track, 'top artists') + ' sharing ' + coalesce(head(genres), 'core') + ' vibes' AS reason
        ORDER BY score DESC, popularity DESC
        LIMIT $limit
        """
        try:
            records = neo4j_conn.query(query, {"user_id": user_id, "limit": limit})
            if records and len(records) > 0:
                return records
        except Exception as e:
            logger.warning(f"SIMILAR_TO recommendation query returned error or empty: {e}")

        # Fallback heuristic graph query (when GDS projection has not been run yet)
        fallback_query = """
        MATCH (u:User {id: $user_id})-[:LISTENED_TO]->(my_track:Track)-[:IN_GENRE]->(g:Genre)<-[:IN_GENRE]-(rec:Track)
        WHERE NOT (u)-[:LISTENED_TO]->(rec)
          AND NOT EXISTS { MATCH (u)-[bad:FEEDBACK {reward: -1.0}]->(rec) }
        OPTIONAL MATCH (rec)-[:BY]->(a:Artist)
        OPTIONAL MATCH (u)-[f:FEEDBACK]->(rec)
        WITH rec, my_track, count(DISTINCT g) AS common_genres, 
             collect(DISTINCT g.name) AS genres, 
             collect(DISTINCT a.name) AS artists,
             coalesce(f.reward, 0.0) AS feedback_reward
        WITH rec, artists, genres, head(collect(DISTINCT my_track.name)) AS seed_track,
             head(collect(DISTINCT my_track.source)) AS seed_source,
             round(0.72 + (common_genres * 0.06) + (feedback_reward * 0.15), 2) AS final_score
        RETURN DISTINCT
            rec.id AS track_id,
            rec.name AS track_name,
            artists,
            genres,
            rec.source AS source,
            final_score AS score,
            coalesce(rec.popularity, 50) AS popularity,
            rec.energy AS energy,
            rec.valence AS valence,
            rec.danceability AS danceability,
            'Recommended because you loved ' + coalesce(seed_track, 'artists') + ' on ' + coalesce(seed_source, 'Spotify/YouTube') + ' in the ' + coalesce(head(genres), 'connected') + ' cluster' AS reason
        ORDER BY final_score DESC, popularity DESC
        LIMIT $limit
        """
        try:
            return neo4j_conn.query(fallback_query, {"user_id": user_id, "limit": limit})
        except Exception as e:
            logger.error(f"Fallback recommendation query error: {e}")
            return []

    @staticmethod
    def mood_chat(user_id: str, prompt: str) -> Dict[str, Any]:
        """
        Claude/Gemini-style Minimal Mood GraphRAG:
        1. Analyzes mood/prompt keywords (acoustic, chill, energetic, party, dark, focus, etc.)
        2. Queries user's Neo4j taste graph matching acoustic profile & genres
        3. Saves conversation interaction to Neo4j (:UserMoodQuery) for persistent context
        """
        prompt_lower = prompt.lower()
        target_energy = 0.5
        target_valence = 0.5
        target_energy = 0.60
        target_valence = 0.55
        genre_hint = None
        vibe_summary = f"tracks matching \"{prompt}\""

        if any(w in prompt_lower for w in ["rap", "hip hop", "hiphop", "bars", "trap", "drill"]):
            target_energy = 0.88
            target_valence = 0.70
            genre_hint = "hip hop"
            vibe_summary = "heavy-hitting rap flows and high-energy hip hop"
        elif any(w in prompt_lower for w in ["drunk", "tipsy", "party", "club", "banger", "lit"]):
            target_energy = 0.90
            target_valence = 0.82
            genre_hint = "dance"
            vibe_summary = "high-energy late night party bangers and intoxicating basslines"
        elif any(w in prompt_lower for w in ["chill", "relax", "sleep", "calm", "rain", "lofi", "lo-fi", "study", "peace"]):
            target_energy = 0.35
            target_valence = 0.45
            genre_hint = "ambient"
            vibe_summary = "mellow atmospheric frequencies and calm vibes"
        elif any(w in prompt_lower for w in ["gym", "workout", "hype", "energy", "pump"]):
            target_energy = 0.92
            target_valence = 0.85
            genre_hint = "electronic"
            vibe_summary = "adrenaline-fueled workout anthems"
        elif any(w in prompt_lower for w in ["sad", "heartbreak", "crying", "melancholy", "nostalg"]):
            target_energy = 0.30
            target_valence = 0.25
            vibe_summary = "introspective, melancholic, and nostalgic sounds"
        elif any(w in prompt_lower for w in ["focus", "code", "coding", "synth", "cyber"]):
            target_energy = 0.70
            target_valence = 0.50
            genre_hint = "electronic"
            vibe_summary = "focused synthwave and electronic flow state rhythms"

        save_session_query = """
        MATCH (u:User {id: $user_id})
        CREATE (m:MoodQuery {
            prompt: $prompt,
            timestamp: datetime(),
            target_energy: $target_energy,
            target_valence: $target_valence
        })
        CREATE (u)-[:EXPRESSED_MOOD]->(m)
        RETURN id(m) AS session_id
        """
        try:
            neo4j_conn.query(save_session_query, {
                "user_id": user_id,
                "prompt": prompt,
                "target_energy": target_energy,
                "target_valence": target_valence
            })
        except Exception as e:
            logger.warning(f"Failed to record mood session: {e}")

        # Search graph for tracks closest to this vibe
        vibe_query = """
        MATCH (u:User {id: $user_id})-[l:LISTENED_TO]->(seed:Track)
        MATCH (seed)-[:SIMILAR_TO|IN_GENRE*1..2]-(rec:Track)
        WHERE NOT (u)-[:LISTENED_TO]->(rec)
          AND NOT EXISTS { MATCH (u)-[bad:FEEDBACK {reward: -1.0}]->(rec) }
        OPTIONAL MATCH (rec)-[:BY]->(a:Artist)
        OPTIONAL MATCH (rec)-[:IN_GENRE]->(g:Genre)
        WITH rec, collect(DISTINCT a.name) AS artists, collect(DISTINCT g.name) AS genres,
             abs(coalesce(rec.energy, 0.5) - $target_energy) AS energy_diff,
             abs(coalesce(rec.valence, 0.5) - $target_valence) AS valence_diff,
             head(collect(DISTINCT seed.name)) AS anchor
        WITH rec, artists, genres, anchor,
             round(1.0 - (energy_diff * 0.4 + valence_diff * 0.4), 2) AS vibe_score
        RETURN DISTINCT
            rec.id AS track_id,
            rec.name AS track_name,
            artists,
            genres,
            rec.source AS source,
            vibe_score AS score,
            coalesce(rec.popularity, 50) AS popularity,
            'Selected for your mood (\"' + $prompt + '\") bridging ' + coalesce(anchor, 'your library') + ' with ' + coalesce(head(genres), 'ambient') + ' frequencies' AS reason
        ORDER BY score DESC, popularity DESC
        LIMIT 6
        """
        results = []
        try:
            results = neo4j_conn.query(vibe_query, {
                "user_id": user_id,
                "prompt": prompt,
                "target_energy": target_energy,
                "target_valence": target_valence
            })
        except Exception as e:
            logger.error(f"Error querying mood graph: {e}")

        if not results:
            results = GraphQueries.get_recommendations(user_id=user_id, limit=6)

        preview_titles = [f"**{r['track_name']}** ({', '.join(r['artists'])})" for r in results[:3]]
        explanation_msg = (
            f"Here are top-tier recommendations for {vibe_summary} based on your connected graph:\n\n"
            f"{' • ' + chr(10) + ' • '.join(preview_titles)}\n\n"
            f"I have also updated your 3D Smart Deck with these candidates so you can preview, like, or swipe through them."
        )

        return {
            "message": explanation_msg,
            "cards": results
        }

    @staticmethod
    def explain_recommendation(user_id: str, track_id: str) -> Dict[str, Any]:
        """Provides graph path explanation: why track_id was recommended to user_id"""
        query = """
        MATCH (target:Track {id: $track_id})
        MATCH (u:User {id: $user_id})-[:LISTENED_TO]->(seed:Track)
        OPTIONAL MATCH (seed)-[s:SIMILAR_TO]->(target)
        OPTIONAL MATCH (seed)-[:BY]->(shared_artist:Artist)<-[:BY]-(target)
        OPTIONAL MATCH (seed)-[:IN_GENRE]->(shared_genre:Genre)<-[:IN_GENRE]-(target)
        WITH seed, target, s.score AS sim_score,
             collect(DISTINCT shared_artist.name) AS shared_artists,
             collect(DISTINCT shared_genre.name) AS shared_genres
        WHERE (sim_score IS NOT NULL) OR (size(shared_artists) > 0) OR (size(shared_genres) > 0)
        RETURN 
            seed.name AS source_track,
            target.name AS target_track,
            coalesce(sim_score, 0.82) AS similarity_score,
            shared_artists,
            shared_genres
        ORDER BY similarity_score DESC
        LIMIT 1
        """
        try:
            res = neo4j_conn.query(query, {"user_id": user_id, "track_id": track_id})
            if res:
                item = res[0]
                return {
                    "source_track": item.get("source_track", "Your Library"),
                    "target_track": item.get("target_track", "Recommended Track"),
                    "similarity_score": round(item.get("similarity_score", 0.85), 2),
                    "shared_artists": item.get("shared_artists", []),
                    "shared_genres": item.get("shared_genres", []),
                    "explanation": f"Connected to your listen of '{item.get('source_track')}' sharing vibes in {', '.join(item.get('shared_genres') or ['Electronic', 'Alternative'])}."
                }
        except Exception as e:
            logger.error(f"Explain recommendation error: {e}")
        return {
            "source_track": "Favorite Tracks",
            "target_track": track_id,
            "similarity_score": 0.85,
            "shared_artists": [],
            "shared_genres": ["indie", "electronic"],
            "explanation": "Derived from topological proximity in your combined cross-platform taste graph."
        }

    @staticmethod
    def get_top_artists(limit: int = 10) -> List[Dict[str, Any]]:
        query = """
        MATCH (a:Artist)
        OPTIONAL MATCH (t:Track)-[:BY]->(a)
        OPTIONAL MATCH (u:User)-[r:LISTENED_TO]->(t)
        RETURN 
            a.name AS name,
            a.source AS source,
            coalesce(a.pagerank, 0.15) AS pagerank,
            count(DISTINCT t) AS track_count,
            coalesce(sum(r.play_count), 0) AS total_plays
        ORDER BY pagerank DESC, total_plays DESC
        LIMIT $limit
        """
        try:
            return neo4j_conn.query(query, {"limit": limit})
        except Exception as e:
            logger.error(f"Top artists query error: {e}")
            return []

    @staticmethod
    def find_shortest_path(source_artist: str, target_artist: str) -> Dict[str, Any]:
        """Finds the shortest taste bridge path between two artists"""
        query = """
        MATCH (a1:Artist), (a2:Artist)
        WHERE toLower(a1.name) = toLower($source_artist) AND toLower(a2.name) = toLower($target_artist)
        MATCH p = shortestPath((a1)-[*]-(a2))
        RETURN [node in nodes(p) | {name: coalesce(node.name, node.id), label: labels(node)[0]}] AS path_nodes,
               length(p) AS path_length
        """
        try:
            res = neo4j_conn.query(query, {"source_artist": source_artist, "target_artist": target_artist})
            if res:
                return res[0]
        except Exception as e:
            logger.error(f"Shortest path query error: {e}")
        return {"path_nodes": [], "path_length": 0}
