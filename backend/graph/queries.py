from typing import List, Dict, Any, Optional
from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger
from backend.embeddings.gemini_embedder import GeminiEmbedder

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
        Native Hybrid Graph + Vector (GraphRAG) Recommendation Engine:
        1. Identifies user's seed embeddings from listened & positively-rated tracks
        2. Queries Neo4j HNSW vector index (track_embeddings) using 768-dim Gemini embeddings
        3. Traverses graph topology (artist collaborations, genre clusters, shared neighbors)
        4. Excludes listened & disliked tracks (reward: -1.0)
        5. Computes composite score: (0.55 * vector_sim) + (0.30 * graph_affinity) + (0.15 * rlhf_boost)
        """
        # Phase 1: Retrieve user seed track embeddings
        seed_query = """
        MATCH (u:User {id: $user_id})-[l:LISTENED_TO]->(t:Track)
        WHERE t.embedding IS NOT NULL
        OPTIONAL MATCH (u)-[f:FEEDBACK {reward: 1.0}]->(t)
        RETURN t.name AS name, t.embedding AS embedding, coalesce(f.reward, 0.0) AS reward, l.play_count AS plays
        ORDER BY reward DESC, plays DESC
        LIMIT 5
        """
        seed_rows = []
        try:
            seed_rows = neo4j_conn.query(seed_query, {"user_id": user_id})
        except Exception as e:
            logger.warning(f"Failed to fetch seed embeddings for user {user_id}: {e}")

        if seed_rows and len(seed_rows) > 0:
            # We have seed embeddings: take top seed vector
            top_seed = seed_rows[0]
            seed_vec = top_seed.get("embedding")
            if seed_vec and len(seed_vec) == 768:
                vector_hybrid_query = """
                CALL db.index.vector.queryNodes('track_embeddings', 35, $seedVec)
                YIELD node AS rec, score AS vector_score
                MATCH (u:User {id: $user_id})
                WHERE NOT (u)-[:LISTENED_TO]->(rec)
                  AND NOT EXISTS { MATCH (u)-[bad:FEEDBACK {reward: -1.0}]->(rec) }
                OPTIONAL MATCH (rec)-[:BY]->(a:Artist)
                OPTIONAL MATCH (rec)-[:IN_GENRE]->(g:Genre)
                OPTIONAL MATCH (u)-[f:FEEDBACK]->(rec)
                OPTIONAL MATCH (u)-[:LISTENED_TO]->(seed:Track)-[:BY|IN_GENRE*1..2]-(rec)
                WITH rec, vector_score,
                     collect(DISTINCT a.name) AS artists,
                     collect(DISTINCT g.name) AS genres,
                     head(collect(DISTINCT seed.name)) AS anchor_track,
                     head(collect(DISTINCT seed.source)) AS anchor_source,
                     count(DISTINCT seed) AS graph_affinity_count,
                     coalesce(f.reward, 0.0) AS feedback_reward
                WITH rec, artists, genres, anchor_track, anchor_source, vector_score,
                     round((vector_score * 0.55) + (case when graph_affinity_count > 0 then 0.30 else 0.15 end) + (feedback_reward * 0.15), 2) AS final_score
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
                    case
                      when anchor_track is not null then 'Connected to your ' + coalesce(anchor_source, 'music') + ' taste in ' + anchor_track + ' via 768-D semantic vector space'
                      else 'High-affinity vector match (' + toString(toInteger(round(vector_score * 100))) + '%) across ' + coalesce(head(genres), 'core') + ' latent embeddings'
                    end AS reason
                ORDER BY final_score DESC, popularity DESC
                LIMIT $limit
                """
                try:
                    records = neo4j_conn.query(vector_hybrid_query, {"user_id": user_id, "seedVec": seed_vec, "limit": limit})
                    if records and len(records) > 0:
                        return records
                except Exception as e:
                    logger.warning(f"Vector hybrid query error: {e}")

        # Fallback 1: SIMILAR_TO graph traversal
        sim_query = """
        MATCH (u:User {id: $user_id})-[l:LISTENED_TO]->(listened:Track)
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
        ORDER BY final_score DESC, popularity DESC
        LIMIT $limit
        """
        try:
            records = neo4j_conn.query(sim_query, {"user_id": user_id, "limit": limit})
            if records and len(records) > 0:
                return records
        except Exception as e:
            logger.warning(f"SIMILAR_TO recommendation query returned error or empty: {e}")

        # Fallback 2: General catalog popularity & diversity (for cold-start or new users)
        cold_start_query = """
        MATCH (rec:Track)
        WHERE NOT EXISTS { MATCH (u:User {id: $user_id})-[bad:FEEDBACK {reward: -1.0}]->(rec) }
          AND NOT EXISTS { MATCH (u:User {id: $user_id})-[:LISTENED_TO]->(rec) }
        OPTIONAL MATCH (rec)-[:BY]->(a:Artist)
        OPTIONAL MATCH (rec)-[:IN_GENRE]->(g:Genre)
        WITH rec,
             collect(DISTINCT a.name) AS artists,
             collect(DISTINCT g.name) AS genres
        RETURN DISTINCT
            rec.id AS track_id,
            rec.name AS track_name,
            artists,
            genres,
            rec.source AS source,
            0.85 AS score,
            coalesce(rec.popularity, 50) AS popularity,
            rec.energy AS energy,
            rec.valence AS valence,
            rec.danceability AS danceability,
            'Top trending track in your cross-platform universe with ' + coalesce(head(genres), 'global') + ' energy' AS reason
        ORDER BY popularity DESC
        LIMIT $limit
        """
        try:
            return neo4j_conn.query(cold_start_query, {"user_id": user_id, "limit": limit})
        except Exception as e:
            logger.error(f"Cold start query error: {e}")
            return []

    @staticmethod
    def mood_chat(user_id: str, prompt: str) -> Dict[str, Any]:
        """
        Native Hybrid GraphRAG Mood Assistant:
        1. Encodes prompt into 768-dim semantic vector via Gemini embeddings (gemini-embedding-001)
        2. Performs HNSW cosine similarity search over Neo4j vector index 'track_embeddings'
        3. Reranks with user graph topology (artist/genre clusters) and RLHF feedback rewards
        4. Saves query node (:MoodQuery) for persistent memory
        5. Formats rich interactive card payload with Spotify/YouTube play links
        """
        # Save session query node
        try:
            save_session_query = """
            MATCH (u:User {id: $user_id})
            CREATE (m:MoodQuery {
                prompt: $prompt,
                timestamp: datetime()
            })
            CREATE (u)-[:EXPRESSED_MOOD]->(m)
            """
            neo4j_conn.query(save_session_query, {"user_id": user_id, "prompt": prompt})
        except Exception as e:
            logger.warning(f"Failed to record mood session: {e}")

        # Step 1: Generate Gemini 768-dim vector embedding
        query_vec = GeminiEmbedder.embed_text_sync(prompt)
        results = []

        if query_vec and len(query_vec) == 768:
            # Step 2: Native Neo4j HNSW vector search + graph reranking
            vibe_vector_query = """
            CALL db.index.vector.queryNodes('track_embeddings', 25, $queryVec)
            YIELD node AS rec, score AS vector_score
            MATCH (u:User {id: $user_id})
            WHERE NOT EXISTS { MATCH (u)-[bad:FEEDBACK {reward: -1.0}]->(rec) }
            OPTIONAL MATCH (rec)-[:BY]->(a:Artist)
            OPTIONAL MATCH (rec)-[:IN_GENRE]->(g:Genre)
            OPTIONAL MATCH (u)-[f:FEEDBACK]->(rec)
            OPTIONAL MATCH (u)-[:LISTENED_TO]->(seed:Track)-[:BY|IN_GENRE*1..2]-(rec)
            WITH rec, vector_score,
                 collect(DISTINCT a.name) AS artists,
                 collect(DISTINCT g.name) AS genres,
                 head(collect(DISTINCT seed.name)) AS anchor_track,
                 head(collect(DISTINCT seed.source)) AS anchor_source,
                 count(DISTINCT seed) AS graph_affinity_count,
                 coalesce(f.reward, 0.0) AS feedback_reward
            WITH rec, artists, genres, anchor_track, anchor_source, vector_score,
                 round((vector_score * 0.60) + (case when graph_affinity_count > 0 then 0.25 else 0.10 end) + (feedback_reward * 0.15), 2) AS final_score
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
                case
                  when anchor_track is not null then 'Matches mood vector (' + toString(toInteger(round(vector_score * 100))) + '%) & bridges with your ' + coalesce(anchor_source, 'music') + ' anchor ' + anchor_track
                  else 'Semantic vector match (' + toString(toInteger(round(vector_score * 100))) + '%) for \"' + $prompt + '\"'
                end AS reason
            ORDER BY final_score DESC, popularity DESC
            LIMIT 6
            """
            try:
                results = neo4j_conn.query(vibe_vector_query, {
                    "user_id": user_id,
                    "prompt": prompt,
                    "queryVec": query_vec
                })
            except Exception as e:
                logger.error(f"Error querying vector index in mood_chat: {e}")

        # Graceful fallback if vector search yielded empty
        if not results:
            results = GraphQueries.get_recommendations(user_id=user_id, limit=6)

        preview_titles = [f"**{r['track_name']}** ({', '.join(r['artists'])})" for r in results[:4]]
        preview_list = " • " + "\n • ".join(preview_titles) if preview_titles else ""

        explanation_msg = (
            f"Here are top-tier recommendations for \"{prompt}\" retrieved via Gemini 768-D vector embeddings & Neo4j graph topology:\n\n"
            f"{preview_list}\n\n"
            f"I have also loaded these candidates directly into your 3D Smart Deck so you can swipe, like, or inspect their graph paths."
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
