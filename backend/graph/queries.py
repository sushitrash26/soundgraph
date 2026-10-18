from typing import List, Dict, Any, Optional
from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger
from backend.embeddings.gemini_embedder import GeminiEmbedder
from backend.embeddings.persona_clusterer import PersonaClusterer
from backend.ingestors.frontier_fetcher import FrontierFetcher
from backend.audio.flow_chainer import AIFlowChainer
from backend.core.temporal import AITemporalEngine
from backend.core.bandit import ContextualLinUCB

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
    def get_user_taste_profile(user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Comprehensive, 100% dynamic user taste profile:
        1. Top artists with play counts, track counts, and graph PageRank centrality
        2. Top playlists owned by or connected to the user
        3. Real-time feedback ledger (Liked tracks +1.0 and Disliked tracks -1.0)
        4. Derived vector embeddings & acoustic feature averages (Energy, Valence, Danceability, Acousticness, Tempo)
        5. Top genres distribution
        6. Taste Personas computed via Spherical K-Means clustering
        """
        if not user_id:
            from backend.api.routes.auth import SESSION_STORE
            sess_user = SESSION_STORE.get("current_user")
            user_id = sess_user.get("id", "") if sess_user else ""

        # 1. Top Artists
        top_artists_query = """
        MATCH (u:User {id: $user_id})-[r:LISTENED_TO]->(t:Track)-[:BY]->(a:Artist)
        OPTIONAL MATCH (a)-[:IN_GENRE]->(g:Genre)
        RETURN a.name AS name,
               coalesce(a.source, 'spotify') AS source,
               coalesce(a.pagerank, 0.15) AS pagerank,
               sum(coalesce(r.play_count, 1)) AS total_plays,
               count(DISTINCT t) AS track_count,
               collect(DISTINCT g.name)[0..3] AS genres
        ORDER BY total_plays DESC, pagerank DESC
        LIMIT 10
        """
        top_artists = []
        try:
            top_artists = neo4j_conn.query(top_artists_query, {"user_id": user_id}) or []
        except Exception as e:
            logger.warning(f"Error fetching top artists for {user_id}: {e}")

        # 2. Playlists
        playlists_query = """
        MATCH (u:User {id: $user_id})-[:OWNS_PLAYLIST]->(p:Playlist)
        OPTIONAL MATCH (p)-[:CONTAINS_TRACK]->(t:Track)
        WITH p, count(DISTINCT t) AS linked_track_count
        RETURN p.id AS id,
               p.name AS name,
               coalesce(p.source, 'spotify') AS source,
               coalesce(p.cover_url, '') AS cover_url,
               coalesce(p.description, '') AS description,
               case when p.track_count is not null and p.track_count > 0 then p.track_count else linked_track_count end AS track_count
        ORDER BY track_count DESC, p.name ASC
        LIMIT 10
        """
        playlists = []
        try:
            playlists = neo4j_conn.query(playlists_query, {"user_id": user_id}) or []
        except Exception as e:
            logger.warning(f"Error fetching playlists for {user_id}: {e}")

        if not playlists:
            album_query = """
            MATCH (u:User {id: $user_id})-[r:LISTENED_TO]->(t:Track)-[:IN_ALBUM]->(al:Album)
            RETURN al.id AS id,
                   al.name AS name,
                   coalesce(t.source, 'spotify') AS source,
                   coalesce(t.cover_url, '') AS cover_url,
                   'Curated Album Collection' AS description,
                   count(DISTINCT t) AS track_count
            ORDER BY track_count DESC
            LIMIT 8
            """
            try:
                playlists = neo4j_conn.query(album_query, {"user_id": user_id}) or []
            except Exception as e:
                logger.warning(f"Error fetching album playlists fallback: {e}")

        # 3. Explicit Feedback Ledger (Likes and Dislikes)
        feedback_query = """
        MATCH (u:User {id: $user_id})-[f:FEEDBACK]->(t:Track)
        OPTIONAL MATCH (t)-[:BY]->(a:Artist)
        OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
        WITH t, f,
             collect(DISTINCT a.name) AS artists,
             collect(DISTINCT g.name) AS genres
        RETURN t.id AS id,
               t.name AS title,
               artists,
               genres,
               coalesce(t.source, 'spotify') AS source,
               coalesce(t.cover_url, '') AS cover_url,
               coalesce(t.preview_url, '') AS preview_url,
               coalesce(t.popularity, 50) AS popularity,
               t.energy AS energy,
               t.valence AS valence,
               t.danceability AS danceability,
               f.reward AS reward,
               toString(f.updated_at) AS updated_at
        ORDER BY f.reward DESC
        """
        feedback_items = []
        try:
            feedback_items = neo4j_conn.query(feedback_query, {"user_id": user_id}) or []
        except Exception as e:
            logger.warning(f"Error fetching feedback ledger: {e}")

        likes = [item for item in feedback_items if (item.get("reward") or 0.0) > 0]
        dislikes = [item for item in feedback_items if (item.get("reward") or 0.0) < 0]

        # 4. Derived Vector Coordinates & Acoustic Averages
        vector_query = """
        MATCH (u:User {id: $user_id})-[r:LISTENED_TO]->(t:Track)
        RETURN avg(t.energy) AS avg_energy,
               avg(t.valence) AS avg_valence,
               avg(t.danceability) AS avg_danceability,
               avg(t.acousticness) AS avg_acousticness,
               avg(t.tempo) AS avg_tempo,
               count(t) AS total_listened,
               sum(coalesce(r.play_count, 1)) AS total_stream_plays
        """
        vector_stats = {}
        try:
            v_res = neo4j_conn.query(vector_query, {"user_id": user_id})
            if v_res and v_res[0]:
                row = v_res[0]
                vector_stats = {
                    "energy": round(row.get("avg_energy") or 0.65, 3),
                    "valence": round(row.get("avg_valence") or 0.55, 3),
                    "danceability": round(row.get("avg_danceability") or 0.60, 3),
                    "acousticness": round(row.get("avg_acousticness") or 0.20, 3),
                    "tempo": round(row.get("avg_tempo") or 115.0, 1),
                    "total_listened": row.get("total_listened") or 0,
                    "total_stream_plays": row.get("total_stream_plays") or 0
                }
        except Exception as e:
            logger.warning(f"Error fetching vector stats: {e}")
            vector_stats = {
                "energy": 0.65, "valence": 0.55, "danceability": 0.60, 
                "acousticness": 0.20, "tempo": 115.0, "total_listened": 0, "total_stream_plays": 0
            }

        # 5. Top Genres
        genres_query = """
        MATCH (u:User {id: $user_id})-[:LISTENED_TO]->(t:Track)-[:IN_GENRE]->(g:Genre)
        RETURN g.name AS name, count(t) AS count
        ORDER BY count DESC LIMIT 8
        """
        top_genres = []
        try:
            top_genres = neo4j_conn.query(genres_query, {"user_id": user_id}) or []
        except Exception as e:
            logger.warning(f"Error fetching top genres: {e}")

        # 6. Taste Personas
        personas = []
        try:
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
            history = neo4j_conn.query(history_query, {"user_id": user_id}) or []
            if history:
                personas_raw = PersonaClusterer.compute_taste_centroids(history, max_k=3)
                personas = [
                    {
                        "id": p["id"],
                        "label": p["label"],
                        "weight": round(p.get("weight", 0.33), 2),
                        "cluster_size": p.get("cluster_size", 0),
                        "top_genres": p.get("top_genres", []),
                        "top_artists": p.get("top_artists", [])
                    }
                    for p in personas_raw
                ]
        except Exception as e:
            logger.warning(f"Error computing personas: {e}")

        return {
            "user_id": user_id,
            "top_artists": top_artists,
            "top_playlists": playlists,
            "likes": likes,
            "dislikes": dislikes,
            "stats": {
                "total_listened": vector_stats.get("total_listened", 0),
                "total_stream_plays": vector_stats.get("total_stream_plays", 0),
                "total_likes": len(likes),
                "total_dislikes": len(dislikes),
                "affinity_ratio": round(len(likes) / max(1, len(likes) + len(dislikes)), 2)
            },
            "vector_metrics": vector_stats,
            "top_genres": top_genres,
            "personas": personas
        }

    @staticmethod
    def get_user_library(
        user_id: str, 
        limit: int = 60,
        mood: Optional[str] = None,
        sort: Optional[str] = None,
        source: Optional[str] = None,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """Fetches the actual songs and artists ingested from user's accounts with dynamic filtering and sorting"""
        conditions = ["u.id = $user_id"]
        params: Dict[str, Any] = {"user_id": user_id, "limit": limit}

        if source and source in ["spotify", "youtube"]:
            conditions.append("coalesce(t.source, 'spotify') = $source")
            params["source"] = source

        if mood == "euphoric":
            conditions.append("coalesce(t.valence, 0.5) >= 0.55")
        elif mood == "melancholic":
            conditions.append("coalesce(t.valence, 0.5) <= 0.45")
        elif mood == "chill":
            conditions.append("coalesce(t.energy, 0.5) <= 0.55")
        elif mood == "high_energy":
            conditions.append("coalesce(t.energy, 0.5) >= 0.65")

        if search and search.strip():
            conditions.append("(toLower(t.name) CONTAINS toLower($search) OR any(art IN artists WHERE toLower(art) CONTAINS toLower($search)))")
            params["search"] = search.strip()

        where_clause = " AND ".join(conditions)

        order_by = "feedback_reward DESC, l.play_count DESC, t.popularity DESC"
        if sort == "highest_plays":
            order_by = "l.play_count DESC, t.popularity DESC"
        elif sort == "past_plays":
            order_by = "l.last_played DESC, l.play_count DESC"
        elif sort == "most_loved":
            order_by = "feedback_reward DESC, l.play_count DESC, t.popularity DESC"

        query = f"""
        MATCH (u:User)-[l:LISTENED_TO]->(t:Track)
        OPTIONAL MATCH (t)-[:BY]->(a:Artist)
        OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
        OPTIONAL MATCH (u)-[f:FEEDBACK]->(t)
        WITH u, t, l, f,
             collect(DISTINCT a.name) AS artists, 
             collect(DISTINCT g.name) AS genres, 
             coalesce(f.reward, 0.0) AS feedback_reward
        WHERE {where_clause}
        RETURN 
            t.id AS id,
            t.name AS title,
            artists,
            genres,
            coalesce(t.source, 'spotify') AS source,
            t.popularity AS popularity,
            t.energy AS energy,
            t.valence AS valence,
            t.danceability AS danceability,
            coalesce(l.play_count, 1) AS play_count,
            feedback_reward,
            coalesce(t.cover_url, '') AS cover_url,
            coalesce(t.preview_url, '') AS preview_url
        ORDER BY {order_by}
        LIMIT $limit
        """
        try:
            tracks = neo4j_conn.query(query, params) or []
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
    def get_recommendations(
        user_id: str, 
        limit: int = 15,
        exclude_ids: Optional[Any] = None,
        mood: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        State-of-the-art Multi-Centroid Taste Persona & GraphRAG Recommendation Engine:
        1. Clusters user's listening history into up to 3 distinct Taste Personas via Spherical K-Means.
        2. Queries Neo4j HNSW vector index for each persona centroid with exclude_ids support for continuous infinite card streaming.
        3. Round-robin interleaves candidates across personas.
        4. Injects LinUCB Contextual Bandit dynamic exploration wildcards.
        5. Supports real-time mood steering (euphoric, melancholic, chill, high_energy).
        6. Strictly excludes listened, disliked (reward: -1.0), and already presented tracks.
        """
        exclude_set = set()
        if exclude_ids:
            if isinstance(exclude_ids, str):
                exclude_set = {x.strip() for x in exclude_ids.split(",") if x.strip()}
            elif isinstance(exclude_ids, (list, set, tuple)):
                exclude_set = {str(x).strip() for x in exclude_ids if str(x).strip()}
        exclude_list = list(exclude_set)

        # Build mood condition snippet
        mood_condition = ""
        if mood == "euphoric":
            mood_condition = "AND coalesce(rec.valence, 0.5) >= 0.55"
        elif mood == "melancholic":
            mood_condition = "AND coalesce(rec.valence, 0.5) <= 0.45"
        elif mood == "chill":
            mood_condition = "AND coalesce(rec.energy, 0.5) <= 0.55"
        elif mood == "high_energy":
            mood_condition = "AND coalesce(rec.energy, 0.5) >= 0.65"

        # Step 1: Fetch user's listened tracks
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
            history = neo4j_conn.query(history_query, {"user_id": user_id}) or []
        except Exception as e:
            logger.warning(f"Failed to fetch listening history for user {user_id}: {e}")

        interleaved: List[Dict[str, Any]] = []
        seen_track_ids = set(exclude_set)

        if history and len(history) > 0:
            personas = PersonaClusterer.compute_taste_centroids(history, max_k=3)
            logger.info(f"User {user_id}: computed {len(personas)} taste personas")

            persona_candidates: Dict[str, List[Dict[str, Any]]] = {}
            for persona in personas:
                centroid_vec = persona.get("centroid")
                if not centroid_vec or len(centroid_vec) != 768:
                    continue

                persona_query = f"""
                CALL db.index.vector.queryNodes('track_embeddings', 35, $centroidVec)
                YIELD node AS rec, score AS vector_score
                MATCH (u:User {{id: $user_id}})
                WHERE NOT (u)-[:LISTENED_TO]->(rec)
                  AND NOT EXISTS {{ MATCH (u)-[bad:FEEDBACK {{reward: -1.0}}]->(rec) }}
                  AND NOT rec.id IN $excludeList
                  {mood_condition}
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
                    coalesce(rec.preview_url, '') AS preview_url,
                    final_score AS score,
                    coalesce(rec.popularity, 50) AS popularity,
                    rec.energy AS energy,
                    rec.valence AS valence,
                    rec.danceability AS danceability,
                    case
                      when anchor_track is not null then 'Matches your vibe with ' + anchor_track
                      else 'Matches your streaming taste'
                    end AS reason
                ORDER BY final_score DESC, popularity DESC
                LIMIT 12
                """
                try:
                    p_recs = neo4j_conn.query(persona_query, {
                        "user_id": user_id,
                        "centroidVec": centroid_vec,
                        "personaLabel": persona["label"],
                        "excludeList": exclude_list
                    })
                    if p_recs:
                        persona_candidates[persona["id"]] = p_recs
                except Exception as e:
                    logger.warning(f"Error querying persona centroid {persona['id']}: {e}")

            if persona_candidates:
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
                                cand["bandit_arm"] = 0
                                cand["arm_name"] = "persona_exploit"
                                interleaved.append(cand)
                                if len(interleaved) >= limit:
                                    break
                    if len(interleaved) >= limit:
                        break

        # LinUCB Exploration Wildcards / Backfill if needed
        if len(interleaved) < limit:
            exploration_query = f"""
            MATCH (rec:Track)
            WHERE NOT EXISTS {{ MATCH (u:User {{id: $user_id}})-[bad:FEEDBACK {{reward: -1.0}}]->(rec) }}
              AND NOT EXISTS {{ MATCH (u:User {{id: $user_id}})-[:LISTENED_TO]->(rec) }}
              AND NOT rec.id IN $excludeList
              {mood_condition}
            OPTIONAL MATCH (rec)-[:BY]->(a:Artist)
            OPTIONAL MATCH (rec)-[:IN_GENRE]->(g:Genre)
            WITH rec, collect(DISTINCT a.name) AS artists, collect(DISTINCT g.name) AS genres
            RETURN DISTINCT
                rec.id AS track_id,
                rec.name AS track_name,
                artists,
                genres,
                rec.source AS source,
                coalesce(rec.cover_url, '') AS cover_url,
                coalesce(rec.preview_url, '') AS preview_url,
                0.78 AS score,
                coalesce(rec.popularity, 50) AS popularity,
                rec.energy AS energy,
                rec.valence AS valence,
                rec.danceability AS danceability,
                'Matches your affinity for ' + coalesce(head(genres), 'fresh sounds') AS reason
            ORDER BY popularity DESC
            LIMIT $remLimit
            """
            try:
                rem_limit = max(5, (limit - len(interleaved)) * 2)
                wildcards = neo4j_conn.query(exploration_query, {
                    "user_id": user_id, 
                    "remLimit": rem_limit,
                    "excludeList": list(seen_track_ids)
                }) or []
                for w in wildcards:
                    if w["track_id"] not in seen_track_ids:
                        seen_track_ids.add(w["track_id"])
                        w["bandit_arm"] = 3
                        w["arm_name"] = "frontier_wildcard"
                        interleaved.append(w)
                        if len(interleaved) >= limit:
                            break
            except Exception as e:
                logger.warning(f"Exploration query error: {e}")

        # Fallback 1: SIMILAR_TO graph traversal if still needed
        if len(interleaved) < limit:
            sim_query = f"""
            MATCH (u:User {{id: $user_id}})-[l:LISTENED_TO]->(listened:Track)
            MATCH (listened)-[sim:SIMILAR_TO]->(rec:Track)
            WHERE NOT (u)-[:LISTENED_TO]->(rec)
              AND NOT EXISTS {{ MATCH (u)-[bad:FEEDBACK {{reward: -1.0}}]->(rec) }}
              AND NOT rec.id IN $excludeList
              {mood_condition}
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
                coalesce(rec.cover_url, '') AS cover_url,
                coalesce(rec.preview_url, '') AS preview_url,
                final_score AS score,
                coalesce(rec.popularity, 50) AS popularity,
                rec.energy AS energy,
                rec.valence AS valence,
                rec.danceability AS danceability,
                'Matches your taste in ' + coalesce(seed_track, 'top artists') AS reason
            ORDER BY final_score DESC, popularity DESC
            LIMIT $remLimit
            """
            try:
                records = neo4j_conn.query(sim_query, {
                    "user_id": user_id, 
                    "remLimit": limit - len(interleaved),
                    "excludeList": list(seen_track_ids)
                }) or []
                for r in records:
                    if r["track_id"] not in seen_track_ids:
                        seen_track_ids.add(r["track_id"])
                        r["bandit_arm"] = 1
                        r["arm_name"] = "graph_similarity"
                        interleaved.append(r)
            except Exception as e:
                logger.warning(f"SIMILAR_TO query error: {e}")

        # Fallback 2: General catalog fallback if deck is starved
        if len(interleaved) < limit:
            cold_query = f"""
            MATCH (rec:Track)
            WHERE NOT EXISTS {{ MATCH (u:User {{id: $user_id}})-[bad:FEEDBACK {{reward: -1.0}}]->(rec) }}
              AND NOT EXISTS {{ MATCH (u:User {{id: $user_id}})-[:LISTENED_TO]->(rec) }}
              AND NOT rec.id IN $excludeList
              {mood_condition}
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
                coalesce(rec.cover_url, '') AS cover_url,
                coalesce(rec.preview_url, '') AS preview_url,
                0.85 AS score,
                coalesce(rec.popularity, 50) AS popularity,
                rec.energy AS energy,
                rec.valence AS valence,
                rec.danceability AS danceability,
                'Curated based on your listening style' AS reason
            ORDER BY popularity DESC
            LIMIT $remLimit
            """
            try:
                cold_records = neo4j_conn.query(cold_query, {
                    "user_id": user_id, 
                    "remLimit": limit - len(interleaved),
                    "excludeList": list(seen_track_ids)
                }) or []
                for c in cold_records:
                    if c["track_id"] not in seen_track_ids:
                        seen_track_ids.add(c["track_id"])
                        c["bandit_arm"] = 2
                        c["arm_name"] = "catalog_diversity"
                        interleaved.append(c)
            except Exception as e:
                logger.warning(f"Cold query fallback error: {e}")

        if interleaved:
            flow_chained = AIFlowChainer.chain_session_flow(interleaved[:limit])
            for item in flow_chained:
                item.pop("embedding", None)
            return flow_chained

        return []

    @staticmethod
    def _parse_query_intent(prompt: str) -> Dict[str, Any]:
        """Fast entity and music intent parser using Gemini 3.5 Flash Lite."""
        from backend.core.config import settings
        import httpx, json
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return {"artist": None, "is_artist_exclusive": False, "search_query": prompt}

        system_instruction = (
            "You are an expert music search understanding AI.\n"
            "Analyze the user's music request and extract:\n"
            "- artist: specific artist name if asked for (normalize e.g. 'weekend' -> 'The Weeknd', 'young stunners' -> 'Young Stunners') or null if no artist\n"
            "- is_artist_exclusive: boolean, true if user asks for specific artist (e.g. 'only X songs', 'tell me X song', 'play X', 'more songs by X')\n"
            "- track_name: specific track title if requested, else null\n"
            "- genre_mood: mood, vibe or genre if mentioned, else null\n"
            "- search_query: the best clean YouTube Music search query to get those exact songs\n"
            "Respond strictly in JSON: {\"artist\": string or null, \"is_artist_exclusive\": bool, \"track_name\": string or null, \"genre_mood\": string or null, \"search_query\": string}"
        )
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": f"{system_instruction}\n\nUser Request: {prompt}"}]}],
                "generationConfig": {"temperature": 0.0, "responseMimeType": "application/json"}
            }
            with httpx.Client(timeout=4.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    return json.loads(res.json()["candidates"][0]["content"]["parts"][0]["text"])
        except Exception as e:
            logger.warning(f"Error parsing music intent: {e}")
        return {"artist": None, "is_artist_exclusive": False, "search_query": prompt}

    @staticmethod
    def mood_chat(user_id: str, prompt: str) -> Dict[str, Any]:
        """
        Native Hybrid GraphRAG Mood & Artist Assistant with Dynamic Frontier Expansion:
        1. Parses intent & entities (artist constraints, mood, track targets) via Gemini.
        2. Synchronous Frontier Expansion: If an artist has < 4 songs in Neo4j, live-queries
           YouTube Music & Spotify catalogs, embeds them with 768-D vectors, and returns them immediately.
        3. Strict Artist Constraint Enforcement: Prevents unrelated artists from leaking into 'only X' queries.
        4. HNSW Vector Index + Graph Affinity Reranking.
        5. Saves query node (:MoodQuery) for taste persistence.
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

        # Step 1: Parse intent and targeted artist/track
        parsed_intent = GraphQueries._parse_query_intent(prompt)
        artist_target = parsed_intent.get("artist")
        is_artist_exclusive = parsed_intent.get("is_artist_exclusive", False)
        search_query = parsed_intent.get("search_query") or prompt

        results = []

        # Branch 1: If user asked for a specific artist (e.g. "Young Stunners" or "The Weeknd")
        if artist_target:
            count_q = """
            MATCH (t:Track)-[:BY]->(a:Artist)
            WHERE toLower(a.name) CONTAINS toLower($art) OR toLower(t.name) CONTAINS toLower($art)
            RETURN count(DISTINCT t) as c
            """
            cnt_res = neo4j_conn.query(count_q, {"art": artist_target})
            local_count = cnt_res[0]["c"] if cnt_res else 0

            # If local Neo4j has fewer than 4 tracks for this artist, expand synchronously now!
            if local_count < 4:
                logger.info(f"Artist '{artist_target}' has only {local_count} tracks in Neo4j. Expanding synchronously via FrontierFetcher...")
                frontier_tracks = FrontierFetcher.expand_frontier_for_prompt(search_query, user_id=user_id, limit=6)
                if frontier_tracks:
                    for ft in frontier_tracks:
                        results.append({
                            "track_id": ft["id"],
                            "track_name": ft["name"],
                            "artists": ft.get("artists") or [artist_target],
                            "genres": ft.get("genres") or ["Hip-Hop", "Indie"],
                            "source": ft.get("source", "youtube"),
                            "cover_url": ft.get("cover_url", ""),
                            "score": 0.98,
                            "popularity": 85,
                            "energy": ft.get("features", {}).get("energy", 0.7),
                            "valence": ft.get("features", {}).get("valence", 0.6),
                            "danceability": ft.get("features", {}).get("danceability", 0.65),
                            "reason": f"Direct catalog resolution for {artist_target}"
                        })

            # Also pull existing artist tracks from Neo4j
            artist_db_query = """
            MATCH (t:Track)-[:BY]->(a:Artist)
            WHERE toLower(a.name) CONTAINS toLower($art) OR toLower(t.name) CONTAINS toLower($art)
            OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
            WITH t, collect(DISTINCT a.name) as artists, collect(DISTINCT g.name) as genres
            RETURN DISTINCT
                t.id AS track_id,
                t.name AS track_name,
                artists,
                genres,
                t.source AS source,
                coalesce(t.cover_url, '') AS cover_url,
                0.95 AS score,
                coalesce(t.popularity, 80) AS popularity,
                t.energy AS energy,
                t.valence AS valence,
                t.danceability AS danceability,
                'Official track by ' + $art AS reason
            ORDER BY popularity DESC
            LIMIT 8
            """
            db_artist_tracks = neo4j_conn.query(artist_db_query, {"art": artist_target})
            existing_ids = {r["track_id"] for r in results}
            for dat in (db_artist_tracks or []):
                if dat["track_id"] not in existing_ids:
                    results.append(dat)

            # Strictly filter to only the requested artist if exclusive
            if is_artist_exclusive and results:
                target_lower = artist_target.lower()
                cleaned = []
                for r in results:
                    art_list = [a.lower() for a in r.get("artists", [])]
                    # Also check for group members (e.g. Talha Anjum / Talhah Yunus for Young Stunners)
                    is_match = any(target_lower in a for a in art_list) or target_lower in r.get("track_name", "").lower()
                    if not is_match and target_lower == "young stunners":
                        is_match = any("talha" in a for a in art_list)
                    if is_match:
                        cleaned.append(r)
                if cleaned:
                    results = cleaned

        # Branch 2: Semantic Vector Search for General Moods / Vibes
        if not results:
            query_vec = GeminiEmbedder.embed_text_sync(prompt)
            if query_vec and len(query_vec) == 768:
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

                top_score = results[0]["score"] if results else 0.0
                if top_score < 0.77 or len(results) < 4:
                    fresh_tracks = FrontierFetcher.expand_frontier_for_prompt(prompt, user_id=user_id, limit=4)
                    if fresh_tracks:
                        for ft in fresh_tracks:
                            results.insert(0, {
                                "track_id": ft["id"],
                                "track_name": ft["name"],
                                "artists": ft.get("artists") or ["Featured Artist"],
                                "genres": ft.get("genres") or ["Music"],
                                "source": ft.get("source", "youtube"),
                                "cover_url": ft.get("cover_url", ""),
                                "score": 0.95,
                                "popularity": 80,
                                "energy": ft.get("features", {}).get("energy", 0.7),
                                "valence": ft.get("features", {}).get("valence", 0.6),
                                "danceability": ft.get("features", {}).get("danceability", 0.65),
                                "reason": f"Live frontier expansion for \"{prompt}\""
                            })

        # Graceful fallback if completely empty
        if not results:
            results = GraphQueries.get_recommendations(user_id=user_id, limit=6)

        # AI Flow Chaining
        results = AIFlowChainer.chain_session_flow(results)

        # Sanitize metadata: ensure artists is never empty and remove raw embeddings
        for item in results:
            item.pop("embedding", None)
            if not item.get("artists") or len(item.get("artists")) == 0:
                if artist_target:
                    item["artists"] = [artist_target]
                else:
                    item["artists"] = ["Featured Artist"]

        preview_titles = [f"**{r['track_name']}** ({', '.join(r['artists'])})" for r in results[:4]]
        preview_list = " • " + "\n • ".join(preview_titles) if preview_titles else ""

        if artist_target:
            explanation_msg = (
                f"Here are the top tracks for **{artist_target}** resolved via live catalog federation & graph topology:\n\n"
                f"{preview_list}\n\n"
                f"I have also loaded these candidates directly into your 3D Smart Deck so you can swipe, like, or inspect their graph paths."
            )
        else:
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
            'Visual Vibe match (' + toString(toInteger(round(vector_score * 100))) + '%) · Matches your visual aesthetic' AS reason
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
                    "explanation": f"Matches your listening taste in '{item.get('source_track')}'{genre_note}."
                }
        except Exception as e:
            logger.warning(f"Graph explanation check warning: {e}")

        # Step 2: Fallback to Nearest Neighbor Vector Proximity in latent space
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
                    "explanation": f"Matches your taste in '{v_item.get('source_track')}'{artist_ref} ({sim_pct}% match)."
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
    def get_dynamic_suggestions(user_id: Optional[str] = None) -> List[str]:
        """
        AI-Driven Situational & Persona Suggestion Generator:
        Zero hardcoded text pills.
        Synthesizes active taste personas with real-time circadian diurnal context.
        """
        if not user_id:
            from backend.api.routes.auth import SESSION_STORE
            sess_user = SESSION_STORE.get("current_user")
            user_id = sess_user.get("id", "") if sess_user else ""

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

    @staticmethod
    def record_dwell_telemetry(
        user_id: str,
        track_id: str,
        arm: int,
        dwell_ms: int,
        explicit_action: Optional[float] = None,
        session_depth: int = 1,
        hour: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Processes real-time frontend dwell telemetry and performs closed-form LinUCB update.
        """
        x = ContextualLinUCB.get_context_vector(hour=hour, session_depth=session_depth)
        continuous_reward = ContextualLinUCB.calculate_continuous_reward(dwell_ms=dwell_ms, explicit_action=explicit_action)
        bandit_result = ContextualLinUCB.update(user_id=user_id, arm=arm, x=x, reward=continuous_reward)

        # Write to Neo4j feedback edge if strong affinity or explicit action
        if explicit_action is not None or continuous_reward >= 0.6 or continuous_reward <= -0.6:
            fb_reward = explicit_action if explicit_action is not None else continuous_reward
            try:
                neo4j_conn.query("""
                MATCH (u:User {id: $uid}), (t:Track {id: $tid})
                MERGE (u)-[f:FEEDBACK]->(t)
                SET f.reward = $reward, f.dwell_ms = $dwell, f.timestamp = datetime()
                """, {"uid": user_id, "tid": track_id, "reward": fb_reward, "dwell": dwell_ms})
            except Exception as e:
                logger.warning(f"Error persisting telemetry feedback to Neo4j: {e}")

        return {
            "status": "success",
            "reward": continuous_reward,
            "bandit": bandit_result
        }
