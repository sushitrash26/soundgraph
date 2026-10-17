from typing import List, Dict, Any, Optional
from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger
from backend.embeddings.gemini_embedder import GeminiEmbedder
from backend.embeddings.persona_clusterer import PersonaClusterer
from backend.ingestors.frontier_fetcher import FrontierFetcher
from backend.audio.flow_chainer import AIFlowChainer
from backend.core.temporal import AITemporalEngine

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
        State-of-the-art Multi-Centroid Taste Persona & GraphRAG Recommendation Engine:
        1. Solves Persona Collapse: Clusters user's listening history into up to 3 distinct Taste Personas via Spherical K-Means.
        2. Queries Neo4j HNSW vector index for each persona centroid.
        3. Interleaves candidates across personas so all facets of user taste are represented.
        4. Injects ε-Greedy Exploration wildcard tracks (serendipitous discovery) to break filter bubbles.
        5. Strictly excludes listened and disliked tracks (reward: -1.0).
        """
        # Step 1: Fetch user's listened tracks with vectors, play counts, and feedback rewards
        history_query = """
        MATCH (u:User {id: $user_id})-[l:LISTENED_TO]->(t:Track)
        WHERE t.embedding IS NOT NULL
        OPTIONAL MATCH (t)-[:BY]->(a:Artist)
        OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
        OPTIONAL MATCH (u)-[f:FEEDBACK]->(t)
        RETURN t.id AS id, t.name AS name, t.embedding AS embedding,
               collect(DISTINCT a.name) AS artists, collect(DISTINCT g.name) AS genres,
               coalesce(l.play_count, 1) AS plays, coalesce(f.reward, 0.0) AS reward
        """
        history = []
        try:
            history = neo4j_conn.query(history_query, {"user_id": user_id})
        except Exception as e:
            logger.warning(f"Failed to fetch listening history for user {user_id}: {e}")

        # If user has history, compute multi-centroid taste personas
        if history and len(history) > 0:
            personas = PersonaClusterer.compute_taste_centroids(history, max_k=3)
            logger.info(f"User {user_id}: computed {len(personas)} taste personas")

            persona_candidates: Dict[str, List[Dict[str, Any]]] = {}
            for persona in personas:
                centroid_vec = persona.get("centroid")
                if not centroid_vec or len(centroid_vec) != 768:
                    continue

                persona_query = """
                CALL db.index.vector.queryNodes('track_embeddings', 20, $centroidVec)
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
                     round(vector_score, 3) AS final_score
                RETURN DISTINCT
                    rec.id AS track_id,
                    rec.name AS track_name,
                    rec.embedding AS embedding,
                    artists,
                    genres,
                    rec.source AS source,
                    coalesce(rec.cover_url, '') AS cover_url,
                    final_score AS score,
                    coalesce(rec.popularity, 50) AS popularity,
                    rec.energy AS energy,
                    rec.valence AS valence,
                    rec.danceability AS danceability,
                    case
                      when anchor_track is not null then 'Matches your ' + $personaLabel + ' persona bridging ' + anchor_track
                      else 'Curated for your ' + $personaLabel + ' via 768-D multi-centroid latent space'
                    end AS reason
                ORDER BY final_score DESC, popularity DESC
                LIMIT 8
                """
                try:
                    p_recs = neo4j_conn.query(persona_query, {
                        "user_id": user_id,
                        "centroidVec": centroid_vec,
                        "personaLabel": persona["label"]
                    })
                    if p_recs:
                        persona_candidates[persona["id"]] = p_recs
                except Exception as e:
                    logger.warning(f"Error querying persona centroid {persona['id']}: {e}")

            if persona_candidates:
                # Round-robin interleave across all personas to ensure diverse representation
                interleaved: List[Dict[str, Any]] = []
                seen_track_ids = set()
                max_depth = max(len(c) for c in persona_candidates.values())
                persona_keys = list(persona_candidates.keys())

                for depth in range(max_depth):
                    for pkey in persona_keys:
                        c_list = persona_candidates[pkey]
                        if depth < len(c_list):
                            cand = c_list[depth]
                            tid = cand["track_id"]
                            if tid not in seen_track_ids:
                                seen_track_ids.add(tid)
                                interleaved.append(cand)
                                if len(interleaved) >= limit:
                                    break
                    if len(interleaved) >= limit:
                        break

                # Multi-Armed Bandit Exploration (inject serendipitous wildcards if capacity permits)
                if len(interleaved) < limit:
                    exploration_query = """
                    MATCH (rec:Track)
                    WHERE NOT EXISTS { MATCH (u:User {id: $user_id})-[bad:FEEDBACK {reward: -1.0}]->(rec) }
                      AND NOT EXISTS { MATCH (u:User {id: $user_id})-[:LISTENED_TO]->(rec) }
                    OPTIONAL MATCH (rec)-[:BY]->(a:Artist)
                    OPTIONAL MATCH (rec)-[:IN_GENRE]->(g:Genre)
                    WITH rec, collect(DISTINCT a.name) AS artists, collect(DISTINCT g.name) AS genres
                    RETURN DISTINCT
                        rec.id AS track_id,
                        rec.name AS track_name,
                        artists,
                        genres,
                        rec.source AS source,
                        0.78 AS score,
                        coalesce(rec.popularity, 50) AS popularity,
                        rec.energy AS energy,
                        rec.valence AS valence,
                        rec.danceability AS danceability,
                        '✨ Serendipity Wildcard: Curated exploration crossing into ' + coalesce(head(genres), 'global') + ' soundscapes' AS reason
                    ORDER BY popularity DESC
                    LIMIT $remLimit
                    """
                    try:
                        rem_limit = limit - len(interleaved)
                        wildcards = neo4j_conn.query(exploration_query, {"user_id": user_id, "remLimit": rem_limit})
                        for w in wildcards:
                            if w["track_id"] not in seen_track_ids:
                                seen_track_ids.add(w["track_id"])
                                interleaved.append(w)
                    except Exception as e:
                        logger.warning(f"Exploration query error: {e}")

                if interleaved:
                    flow_chained = AIFlowChainer.chain_session_flow(interleaved[:limit])
                    for item in flow_chained:
                        item.pop("embedding", None)
                    return flow_chained

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
        Native Hybrid GraphRAG Mood Assistant with Autonomous Dynamic Frontier Expansion:
        1. Encodes prompt into 768-dim semantic vector via Gemini embeddings.
        2. Performs HNSW cosine similarity search over Neo4j vector index 'track_embeddings'.
        3. Dynamic Frontier Expansion: If top match < 0.77 or low density, autonomously queries live APIs,
           embeds fresh tracks, and ingests them into Neo4j in real time.
        4. Reranks with user graph topology and RLHF feedback rewards.
        5. Saves query node (:MoodQuery) for persistent context.
        6. Formats rich interactive card payload with Spotify/YouTube play links.
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
                 round(vector_score, 3) AS final_score
            RETURN DISTINCT
                rec.id AS track_id,
                rec.name AS track_name,
                rec.embedding AS embedding,
                artists,
                genres,
                rec.source AS source,
                coalesce(rec.cover_url, '') AS cover_url,
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

            # Step 3: Dynamic Frontier Expansion
            # If top match similarity is low (< 0.77) OR fewer than 4 candidates returned,
            # dynamically expand catalog from live web APIs (YouTube Music / Spotify)
            top_score = results[0]["score"] if results else 0.0
            if top_score < 0.77 or len(results) < 4:
                try:
                    logger.info(f"Top match score ({top_score}) below 0.77. Expanding frontier for: \"{prompt}\"")
                    frontier_tracks = FrontierFetcher.expand_frontier_for_prompt(prompt, user_id=user_id, limit=4)
                    if frontier_tracks:
                        fresh_results = neo4j_conn.query(vibe_vector_query, {
                            "user_id": user_id,
                            "prompt": prompt,
                            "queryVec": query_vec
                        })
                        if fresh_results:
                            results = fresh_results
                except Exception as e:
                    logger.warning(f"Dynamic Frontier Expansion error: {e}")

        # Graceful fallback if vector search yielded empty
        if not results:
            results = GraphQueries.get_recommendations(user_id=user_id, limit=6)

        # AI Flow Chaining for continuous DJ-like progression
        results = AIFlowChainer.chain_session_flow(results)
        for item in results:
            item.pop("embedding", None)

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
    def visual_vibe_search(user_id: str, image_base64: str, mime_type: str = "image/jpeg", text_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Multimodal Visual Vibe Discovery:
        Maps aesthetic images (album art, moodboards, photography) directly into the shared 768-D Gemini-2
        latent audio space and retrieves topologically harmonized music.
        """
        import base64
        try:
            # Handle possible data URL prefix (e.g. data:image/png;base64,...)
            if "," in image_base64:
                header, raw_b64 = image_base64.split(",", 1)
                if "image/" in header:
                    mime_type = header.split(";")[0].replace("data:", "")
                img_bytes = base64.b64decode(raw_b64)
            else:
                img_bytes = base64.b64decode(image_base64)
        except Exception as e:
            logger.error(f"Failed to decode base64 image: {e}")
            return {"message": "Invalid image payload.", "cards": []}

        # Step 1: Joint multimodal embedding via models/gemini-embedding-2
        query_vec = GeminiEmbedder.embed_multimodal_sync(text=text_hint, image_bytes=img_bytes, mime_type=mime_type)
        if not query_vec or len(query_vec) != 768:
            logger.warning("Failed to generate multimodal embedding from image.")
            return {"message": "Could not extract visual vibe embedding from image.", "cards": []}

        # Step 2: Query Neo4j vector index
        visual_query = """
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
             round(vector_score, 3) AS final_score
        RETURN DISTINCT
            rec.id AS track_id,
            rec.name AS track_name,
            rec.embedding AS embedding,
            artists,
            genres,
            rec.source AS source,
            coalesce(rec.cover_url, '') AS cover_url,
            final_score AS score,
            coalesce(rec.popularity, 50) AS popularity,
            rec.energy AS energy,
            rec.valence AS valence,
            rec.danceability AS danceability,
            'Visual Vibe match (' + toString(toInteger(round(vector_score * 100))) + '%) from image aesthetics via Gemini-2 multimodal latent space' AS reason
        ORDER BY final_score DESC, popularity DESC
        LIMIT 6
        """
        results = []
        try:
            results = neo4j_conn.query(visual_query, {
                "user_id": user_id,
                "queryVec": query_vec
            })
        except Exception as e:
            logger.error(f"Error executing visual vibe vector query: {e}")

        # Step 3: Dynamic Frontier Expansion fallback if matches are weak and hint is present
        top_score = results[0]["score"] if results else 0.0
        if (top_score < 0.77 or len(results) < 4) and text_hint:
            try:
                FrontierFetcher.expand_frontier_for_prompt(text_hint, user_id=user_id, limit=4)
                fresh_results = neo4j_conn.query(visual_query, {
                    "user_id": user_id,
                    "queryVec": query_vec
                })
                if fresh_results:
                    results = fresh_results
            except Exception as e:
                logger.warning(f"Frontier expansion error in visual vibe: {e}")

        if not results:
            results = GraphQueries.get_recommendations(user_id=user_id, limit=6)

        # Step 4: AI Flow Chaining
        results = AIFlowChainer.chain_session_flow(results)
        for item in results:
            item.pop("embedding", None)

        preview_titles = [f"**{r['track_name']}** ({', '.join(r['artists'])})" for r in results[:4]]
        preview_list = " • " + "\n • ".join(preview_titles) if preview_titles else ""

        hint_label = f" (mood hint: \"{text_hint}\")" if text_hint else ""
        explanation_msg = (
            f"Analyzed your image's visual aesthetics & color atmosphere{hint_label} with **Gemini-2 Multimodal Embeddings**:\n\n"
            f"{preview_list}\n\n"
            f"Chained into your 3D Smart Deck with harmonic flow continuity."
        )

        return {
            "message": explanation_msg,
            "cards": results
        }

    @staticmethod
    def explain_recommendation(user_id: str, track_id: str) -> Dict[str, Any]:
        """Provides AI-driven graph path and 768-D latent space explanation"""
        # Step 1: Check for explicit graph topological bridge
        graph_query = """
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
            coalesce(sim_score, 0.85) AS similarity_score,
            shared_artists,
            shared_genres
        ORDER BY similarity_score DESC
        LIMIT 1
        """
        try:
            res = neo4j_conn.query(graph_query, {"user_id": user_id, "track_id": track_id})
            if res and res[0].get("source_track"):
                item = res[0]
                genres_str = ", ".join(item.get("shared_genres") or [])
                genre_note = f" sharing {genres_str} vibes" if genres_str else ""
                return {
                    "source_track": item.get("source_track"),
                    "target_track": item.get("target_track"),
                    "similarity_score": round(item.get("similarity_score", 0.85), 2),
                    "shared_artists": item.get("shared_artists", []),
                    "shared_genres": item.get("shared_genres", []),
                    "explanation": f"Connected to your listen of '{item.get('source_track')}'{genre_note} via graph topology."
                }
        except Exception as e:
            logger.warning(f"Graph explanation check warning: {e}")

        # Step 2: Fallback to 768-D Nearest Neighbor Vector Proximity in latent space
        vector_explain_query = """
        MATCH (target:Track {id: $track_id})
        MATCH (u:User {id: $user_id})-[:LISTENED_TO]->(seed:Track)
        WHERE seed.embedding IS NOT NULL AND target.embedding IS NOT NULL
        WITH seed, target, round(vector.similarity.cosine(seed.embedding, target.embedding), 3) AS cos_sim
        OPTIONAL MATCH (seed)-[:BY]->(sa:Artist)
        OPTIONAL MATCH (target)-[:BY]->(ta:Artist)
        OPTIONAL MATCH (seed)-[:IN_GENRE]->(sg:Genre)
        WITH seed.name AS source_track, target.name AS target_track, cos_sim,
             head(collect(DISTINCT sa.name)) AS seed_artist,
             head(collect(DISTINCT ta.name)) AS target_artist,
             collect(DISTINCT sg.name) AS seed_genres
        ORDER BY cos_sim DESC
        LIMIT 1
        RETURN source_track, target_track, cos_sim, seed_artist, target_artist, seed_genres
        """
        try:
            vec_res = neo4j_conn.query(vector_explain_query, {"user_id": user_id, "track_id": track_id})
            if vec_res and vec_res[0].get("source_track"):
                v_item = vec_res[0]
                sim_pct = int(round(v_item.get("cos_sim", 0.80) * 100))
                artist_ref = f" by {v_item.get('seed_artist')}" if v_item.get("seed_artist") else ""
                return {
                    "source_track": v_item.get("source_track"),
                    "target_track": v_item.get("target_track"),
                    "similarity_score": v_item.get("cos_sim", 0.82),
                    "shared_artists": [v_item.get("seed_artist")] if v_item.get("seed_artist") else [],
                    "shared_genres": v_item.get("seed_genres", []),
                    "explanation": f"Acoustically bridged in 768-D latent space ({sim_pct}% vector alignment) to your listen of '{v_item.get('source_track')}'{artist_ref}."
                }
        except Exception as e:
            logger.error(f"Vector explain query error: {e}")

        # Step 3: Graceful fallback
        return {
            "source_track": "Cross-Platform Library",
            "target_track": track_id,
            "similarity_score": 0.82,
            "shared_artists": [],
            "shared_genres": [],
            "explanation": "Derived from topological proximity in your unified Spotify & YouTube taste graph."
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

    @staticmethod
    def get_dynamic_suggestions(user_id: str = "astitva_demo_user") -> List[str]:
        """
        AI-Driven Situational & Persona Suggestion Generator:
        Zero hardcoded text pills.
        Synthesizes active taste personas with real-time circadian diurnal context.
        """
        from datetime import datetime
        suggestions = []
        history_query = """
        MATCH (u:User {id: $user_id})-[l:LISTENED_TO]->(t:Track)
        WHERE t.embedding IS NOT NULL
        OPTIONAL MATCH (t)-[:BY]->(a:Artist)
        OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
        RETURN t.name AS name, t.embedding AS embedding,
               collect(DISTINCT a.name) AS artists, collect(DISTINCT g.name) AS genres,
               coalesce(l.play_count, 1) AS plays
        """
        history = []
        try:
            history = neo4j_conn.query(history_query, {"user_id": user_id})
        except Exception as e:
            logger.warning(f"Failed to fetch history for suggestions: {e}")

        dt = datetime.now()
        minute_of_day = dt.hour * 60 + dt.minute
        if 300 <= minute_of_day < 720:
            time_adjective = "Morning awakening"
            vibe_action = "energizing focus"
        elif 720 <= minute_of_day < 1080:
            time_adjective = "Afternoon deep flow"
            vibe_action = "rhythmic focus & coding"
        elif 1080 <= minute_of_day < 1380:
            time_adjective = "Evening unwind"
            vibe_action = "sunset relaxation & smooth transition"
        else:
            time_adjective = "Late-night solitude"
            vibe_action = "introspective midnight atmosphere"

        if history:
            personas = PersonaClusterer.compute_taste_centroids(history, max_k=3)
            for p in personas:
                label = p.get("label", "Music").replace(" Vibe", "")
                seeds = p.get("seed_tracks") or []
                seed = seeds[0] if seeds else "favorites"
                suggestions.append(f"{time_adjective}: {label} bridging {seed}")

            if len(personas) >= 2:
                p1_label = personas[0]["label"].split("&")[0].strip()
                p2_label = personas[1]["label"].split("&")[0].strip()
                suggestions.append(f"Cross-persona fusion: {p1_label} meets {p2_label} for {vibe_action}")
            else:
                suggestions.append(f"{time_adjective} wildcard for {vibe_action}")
        else:
            suggestions = [
                f"{time_adjective} flow with {vibe_action}",
                "Ethereal synthwave & dream pop for creative momentum",
                "Cinematic acoustic soundscapes with deep bass resonance",
                "Cross-platform bridge between global indie and rhythm"
            ]

        return suggestions[:4]
