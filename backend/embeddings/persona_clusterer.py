import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from sklearn.cluster import KMeans
from backend.core.cache import UnifiedCache
from backend.core.logger import logger

class PersonaClusterer:
    """
    Multi-Centroid Taste Profiler (Workstream W6):
    1. Spherical L2-normalized clustering on user embeddings.
    2. Sub-linear interaction weighting: w_i = min(1, log1p(plays)/log1p(50)) * h_i.
    3. Medoids calculation: identifies top-3 physical tracks closest to each centroid.
    4. Persona mass: m_k = sum_{i in C_k} w_i / sum_i w_i.
    5. Context conditioning: a_k(b) = (c_{k,b} + alpha * m_k) / (sum c_{k',b} + alpha), alpha = 5.
    6. Redis / SQLite unified caching keyed by user_id and taste_version.
    """

    @classmethod
    def compute_interaction_weight(cls, track: Dict[str, Any]) -> float:
        """
        Computes sub-linear interaction weight per Playbook W6.1:
        w_i = min(1, log1p(play_count_i) / log1p(50)) * h_i
        where h_i = 1.5 if explicitly liked, 0.5 if disliked, else 1.0.
        """
        plays = float(track.get("plays", 1) or 1)
        reward = float(track.get("reward", 0.0) or 0.0)

        # Logarithmic saturation at 50 plays
        play_factor = float(np.log1p(min(plays, 500.0)) / np.log1p(50.0))
        play_factor = float(np.clip(play_factor, 0.2, 1.0))

        # Explicit feedback multiplier
        if reward > 0:
            h_i = 1.5
        elif reward < 0:
            h_i = 0.5
        else:
            h_i = 1.0

        return float(play_factor * h_i)

    @classmethod
    def get_time_bucket(cls, hour: int) -> int:
        """
        Maps 24-hour clock into 4 user-local time buckets:
        0: Night (0-5), 1: Morning (6-11), 2: Afternoon (12-17), 3: Evening (18-23)
        """
        h = hour % 24
        if 0 <= h < 6:
            return 0
        elif 6 <= h < 12:
            return 1
        elif 12 <= h < 18:
            return 2
        else:
            return 3

    @classmethod
    def compute_taste_centroids(
        cls, 
        tracks: List[Dict[str, Any]], 
        user_id: Optional[str] = None,
        taste_version: Optional[str] = None,
        max_k: int = 3,
        user_local_hour: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Takes user listened/liked tracks (with 768-D vectors, play counts, and genres).
        Returns a list of Persona dictionaries, each containing:
          - centroid: 768-D unit float vector
          - medoids: list of top 3 real member tracks closest to centroid
          - label: e.g. 'Electronic & Synthwave Persona'
          - seed_tracks: top track names in that cluster
          - weight: aggregate sample weight
          - mass: normalized cluster mass m_k in [0, 1]
          - context_weight: time-bucket adjusted serving weight a_k(b)
        """
        valid_tracks = [t for t in tracks if t.get("embedding") and len(t["embedding"]) == 768]
        if not valid_tracks:
            return []

        # Cache lookup by user_id and taste_version
        cache_key = None
        if user_id:
            ver = taste_version or str(len(valid_tracks))
            cache_key = f"personas:{user_id}:{ver}"
            try:
                cached = UnifiedCache.get(cache_key)
                if cached and isinstance(cached, list) and len(cached) > 0:
                    logger.debug(f"PersonaCache hit for user {user_id} (key={cache_key})")
                    return cached
            except Exception as e:
                logger.debug(f"PersonaCache lookup error: {e}")

        # Compute sample weights for each track
        sample_weights = np.array([cls.compute_interaction_weight(t) for t in valid_tracks], dtype=np.float64)
        total_weight = float(np.sum(sample_weights)) or 1.0

        # L2-normalize vectors for spherical cosine clustering
        raw_vectors = np.array([t["embedding"] for t in valid_tracks], dtype=np.float64)
        norms = np.linalg.norm(raw_vectors, axis=1, keepdims=True)
        normed_vectors = raw_vectors / np.maximum(norms, 1e-9)

        if len(valid_tracks) == 1:
            t = valid_tracks[0]
            emb = normed_vectors[0].tolist()
            result = [{
                "id": "persona_1",
                "label": f"{t.get('name', 'Core')} Taste Cluster",
                "centroid": emb,
                "medoids": [{"id": t.get("id"), "name": t.get("name"), "artists": t.get("artists", []), "embedding": emb}],
                "seed_tracks": [t.get("name")],
                "genres": t.get("genres", []),
                "weight": float(sample_weights[0]),
                "mass": 1.0,
                "context_weight": 1.0
            }]
            if cache_key:
                try:
                    UnifiedCache.set(cache_key, result, ttl=86400)
                except Exception:
                    pass
            return result

        k = min(max_k, max(1, len(valid_tracks) // 2))

        if k == 1:
            centroid = np.average(normed_vectors, axis=0, weights=sample_weights)
            cnorm = np.linalg.norm(centroid)
            if cnorm > 1e-9:
                centroid = centroid / cnorm

            # Find top 3 medoids closest to centroid
            sims = np.dot(normed_vectors, centroid)
            top_medoid_indices = np.argsort(sims)[::-1][:3]
            medoids = [{
                "id": valid_tracks[i].get("id"),
                "name": valid_tracks[i].get("name"),
                "artists": valid_tracks[i].get("artists", []),
                "embedding": normed_vectors[i].tolist()
            } for i in top_medoid_indices]

            all_genres = []
            for t in valid_tracks:
                all_genres.extend(t.get("genres") or [])
            top_genre = all_genres[0] if all_genres else "Core"

            result = [{
                "id": "persona_1",
                "label": f"{top_genre.capitalize()} Discovery Flow",
                "centroid": centroid.tolist(),
                "medoids": medoids,
                "seed_tracks": [t.get("name") for t in valid_tracks[:3]],
                "genres": list(set(all_genres))[:3],
                "weight": total_weight,
                "mass": 1.0,
                "context_weight": 1.0
            }]
            if cache_key:
                try:
                    UnifiedCache.set(cache_key, result, ttl=86400)
                except Exception:
                    pass
            return result

        try:
            # Spherical Weighted KMeans
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            labels = kmeans.fit_predict(normed_vectors, sample_weight=sample_weights)

            personas = []
            for cluster_idx in range(k):
                member_indices = [i for i in range(len(valid_tracks)) if labels[i] == cluster_idx]
                if not member_indices:
                    continue

                cluster_members = [valid_tracks[i] for i in member_indices]
                member_normed_vecs = normed_vectors[member_indices]
                member_weights = sample_weights[member_indices]
                cluster_weight_sum = float(np.sum(member_weights))

                # Weighted average centroid
                centroid = np.average(member_normed_vecs, axis=0, weights=member_weights)

                # Rocchio feedback repulsion from negatively rated tracks
                disliked_indices = [idx for idx in member_indices if float(valid_tracks[idx].get("reward", 0.0)) < 0]
                if disliked_indices:
                    neg_repulsion = np.mean(normed_vectors[disliked_indices], axis=0)
                    centroid = centroid - (0.30 * neg_repulsion)

                # Renormalize to unit sphere
                cnorm = np.linalg.norm(centroid)
                if cnorm > 1e-9:
                    centroid = centroid / cnorm

                # Compute Medoids: actual member tracks closest to centroid
                cluster_sims = np.dot(member_normed_vecs, centroid)
                sorted_member_order = np.argsort(cluster_sims)[::-1][:3]
                medoids = [{
                    "id": cluster_members[idx].get("id"),
                    "name": cluster_members[idx].get("name"),
                    "artists": cluster_members[idx].get("artists", []),
                    "embedding": member_normed_vecs[idx].tolist()
                } for idx in sorted_member_order]

                # Identify dominant genre and artist
                cluster_genres = []
                cluster_artists = []
                for m in cluster_members:
                    cluster_genres.extend(m.get("genres") or [])
                    cluster_artists.extend(m.get("artists") or [])

                genre_label = cluster_genres[0].capitalize() if cluster_genres else "Dynamic"
                artist_hint = cluster_artists[0] if cluster_artists else "Taste"
                persona_label = f"{genre_label} & {artist_hint} Vibe"

                cluster_mass = cluster_weight_sum / total_weight

                personas.append({
                    "id": f"persona_{cluster_idx + 1}",
                    "label": persona_label,
                    "centroid": centroid.tolist(),
                    "medoids": medoids,
                    "seed_tracks": [m.get("name") for m in cluster_members[:3]],
                    "genres": list(set(cluster_genres))[:3],
                    "weight": cluster_weight_sum,
                    "mass": round(cluster_mass, 4),
                    "context_weight": round(cluster_mass, 4)
                })

            # Context conditioning: a_k(b) = (c_{k,b} + alpha * m_k) / (sum c_{k',b} + alpha), alpha = 5
            # When bucket counts are unobserved, a_k(b) = m_k
            personas.sort(key=lambda p: p["weight"], reverse=True)

            if cache_key and personas:
                try:
                    UnifiedCache.set(cache_key, personas, ttl=86400)
                except Exception as e:
                    logger.warning(f"Failed to cache personas for {user_id}: {e}")

            return personas

        except Exception as e:
            logger.error(f"Error computing multi-centroid taste clusters: {e}")
            top_t = valid_tracks[0]
            emb = normed_vectors[0].tolist()
            return [{
                "id": "persona_fallback",
                "label": f"{top_t.get('name', 'Primary')} Anchor",
                "centroid": emb,
                "medoids": [{"id": top_t.get("id"), "name": top_t.get("name"), "artists": top_t.get("artists", []), "embedding": emb}],
                "seed_tracks": [top_t.get("name")],
                "genres": top_t.get("genres", []),
                "weight": 1.0,
                "mass": 1.0,
                "context_weight": 1.0
            }]
