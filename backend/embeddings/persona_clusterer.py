import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from sklearn.cluster import KMeans
from backend.core.logger import logger

class PersonaClusterer:
    """
    Multi-Centroid Taste Profiler:
    Solves the 'Single-Point Centroid Collapse' problem.
    Instead of collapsing all user history into 1 average or 1 top seed,
    clusters user embeddings into K distinct Taste Personas (e.g. Late-night Synthwave vs Workout Rap vs Acoustic Soul).
    """

    @classmethod
    def compute_taste_centroids(cls, tracks: List[Dict[str, Any]], max_k: int = 3) -> List[Dict[str, Any]]:
        """
        Takes user listened/liked tracks (with 768-D vectors, play counts, and genres).
        Returns a list of Persona dictionaries, each containing:
          - centroid: 768-D float vector
          - label: e.g. "Electronic & Synthwave Persona"
          - seed_tracks: top tracks in that cluster
          - weight: relative importance based on plays/feedback
        """
        valid_tracks = [t for t in tracks if t.get("embedding") and len(t["embedding"]) == 768]
        if not valid_tracks:
            return []

        if len(valid_tracks) == 1:
            t = valid_tracks[0]
            return [{
                "id": "persona_1",
                "label": f"{t.get('name', 'Core')} Taste Cluster",
                "centroid": t["embedding"],
                "seed_tracks": [t.get("name")],
                "genres": t.get("genres", []),
                "weight": 1.0
            }]

        k = min(max_k, max(1, len(valid_tracks) // 2))
        if k == 1:
            # Weighted average centroid
            weights = np.array([max(1.0, float(t.get("plays", 1)) + (float(t.get("reward", 0.0)) * 2.0)) for t in valid_tracks])
            vectors = np.array([t["embedding"] for t in valid_tracks])
            centroid = np.average(vectors, axis=0, weights=weights).tolist()
            # Normalize centroid to unit length for cosine search
            norm = np.linalg.norm(centroid)
            if norm > 0:
                centroid = (np.array(centroid) / norm).tolist()
            
            all_genres = []
            for t in valid_tracks:
                all_genres.extend(t.get("genres") or [])
            top_genre = all_genres[0] if all_genres else "Core"
            
            return [{
                "id": "persona_1",
                "label": f"{top_genre.capitalize()} Discovery Flow",
                "centroid": centroid,
                "seed_tracks": [t.get("name") for t in valid_tracks[:3]],
                "genres": list(set(all_genres))[:3],
                "weight": 1.0
            }]

        try:
            vectors = np.array([t["embedding"] for t in valid_tracks])
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=5)
            labels = kmeans.fit_predict(vectors)

            personas = []
            for cluster_idx in range(k):
                cluster_members = [valid_tracks[i] for i in range(len(valid_tracks)) if labels[i] == cluster_idx]
                if not cluster_members:
                    continue

                member_weights = np.array([
                    max(1.0, float(t.get("plays", 1)) + (float(t.get("reward", 0.0)) * 2.5))
                    for t in cluster_members
                ])
                member_vecs = np.array([t["embedding"] for t in cluster_members])
                centroid = np.average(member_vecs, axis=0, weights=member_weights)

                # Rocchio Vector Feedback Repulsion: steer centroid away from negatively rated tracks
                disliked_vecs = [t["embedding"] for t in cluster_members if float(t.get("reward", 0.0)) < 0]
                if disliked_vecs:
                    neg_repulsion = np.mean(disliked_vecs, axis=0)
                    centroid = centroid - (0.30 * neg_repulsion)

                norm = np.linalg.norm(centroid)
                if norm > 0:
                    centroid = centroid / norm

                # Identify dominant genre and artists in cluster
                cluster_genres = []
                cluster_artists = []
                for m in cluster_members:
                    cluster_genres.extend(m.get("genres") or [])
                    cluster_artists.extend(m.get("artists") or [])

                genre_label = cluster_genres[0].capitalize() if cluster_genres else "Dynamic"
                artist_hint = cluster_artists[0] if cluster_artists else "Taste"
                persona_label = f"{genre_label} & {artist_hint} Vibe"

                personas.append({
                    "id": f"persona_{cluster_idx + 1}",
                    "label": persona_label,
                    "centroid": centroid.tolist(),
                    "seed_tracks": [m.get("name") for m in cluster_members[:3]],
                    "genres": list(set(cluster_genres))[:3],
                    "weight": float(np.sum(member_weights))
                })

            # Sort personas by aggregate weight
            personas.sort(key=lambda p: p["weight"], reverse=True)
            return personas

        except Exception as e:
            logger.error(f"Error computing multi-centroid taste clusters: {e}")
            top_t = valid_tracks[0]
            return [{
                "id": "persona_fallback",
                "label": f"{top_t.get('name', 'Primary')} Anchor",
                "centroid": top_t["embedding"],
                "seed_tracks": [top_t.get("name")],
                "genres": top_t.get("genres", []),
                "weight": 1.0
            }]
