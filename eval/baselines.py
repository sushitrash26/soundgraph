import random
import numpy as np
from typing import List, Dict, Any, Optional
from sklearn.cluster import KMeans

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a < 1e-9 or norm_b < 1e-9:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

class BaseRecommender:
    def rank(
        self, 
        user_train: List[Dict[str, Any]], 
        candidates: List[Dict[str, Any]], 
        top_k: int = 15,
        **kwargs
    ) -> List[Dict[str, Any]]:
        raise NotImplementedError

class RandomBaseline(BaseRecommender):
    def __init__(self, seed: int = 42):
        self.seed = seed

    def rank(
        self, 
        user_train: List[Dict[str, Any]], 
        candidates: List[Dict[str, Any]], 
        top_k: int = 15,
        **kwargs
    ) -> List[Dict[str, Any]]:
        rng = random.Random(self.seed)
        shuffled = list(candidates)
        rng.shuffle(shuffled)
        return shuffled[:top_k]

class PopularityBaseline(BaseRecommender):
    def rank(
        self, 
        user_train: List[Dict[str, Any]], 
        candidates: List[Dict[str, Any]], 
        top_k: int = 15,
        **kwargs
    ) -> List[Dict[str, Any]]:
        sorted_cands = sorted(
            candidates, 
            key=lambda x: (x.get("popularity") or 50, x.get("id")), 
            reverse=True
        )
        return sorted_cands[:top_k]

class SingleMeanCentroidBaseline(BaseRecommender):
    def rank(
        self, 
        user_train: List[Dict[str, Any]], 
        candidates: List[Dict[str, Any]], 
        top_k: int = 15,
        **kwargs
    ) -> List[Dict[str, Any]]:
        train_embeddings = [t["embedding"] for t in user_train if t.get("embedding") is not None]
        if not train_embeddings:
            # Fallback to popularity
            return sorted(candidates, key=lambda x: x.get("popularity") or 50, reverse=True)[:top_k]
            
        mean_centroid = np.mean(train_embeddings, axis=0)
        
        scored = []
        for c in candidates:
            c_emb = c.get("embedding")
            if c_emb is not None:
                sim = _cosine_similarity(mean_centroid, np.array(c_emb))
            else:
                sim = 0.0
            scored.append((sim, c.get("popularity", 50), c))
            
        scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return [item[2] for item in scored[:top_k]]

class CurrentMultiPersonaBaseline(BaseRecommender):
    """
    Simulates the current multi-centroid taste persona clustering:
    - Clusters train tracks into up to 3 personas using KMeans on raw embeddings.
    - Queries cosine nearest neighbors per persona.
    - Round-robin interleaves candidates.
    """
    def __init__(self, seed: int = 42):
        self.seed = seed

    def rank(
        self, 
        user_train: List[Dict[str, Any]], 
        candidates: List[Dict[str, Any]], 
        top_k: int = 15,
        **kwargs
    ) -> List[Dict[str, Any]]:
        valid_train = [t for t in user_train if t.get("embedding") is not None]
        if not valid_train:
            return sorted(candidates, key=lambda x: x.get("popularity") or 50, reverse=True)[:top_k]
            
        embeddings = np.array([t["embedding"] for t in valid_train], dtype=float)
        n = len(embeddings)
        k = min(3, max(1, n // 2))
        
        if k == 1 or n < 3:
            centroids = [np.mean(embeddings, axis=0)]
        else:
            kmeans = KMeans(n_clusters=k, random_state=self.seed, n_init=10)
            kmeans.fit(embeddings)
            centroids = [c for c in kmeans.cluster_centers_]
            
        # For each centroid, rank candidates
        centroid_ranked = []
        for centroid in centroids:
            scored = []
            for c in candidates:
                c_emb = c.get("embedding")
                sim = _cosine_similarity(centroid, np.array(c_emb)) if c_emb is not None else 0.0
                scored.append((sim, c.get("popularity", 50), c))
            scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
            centroid_ranked.append([item[2] for item in scored])
            
        # Round-robin interleave
        interleaved = []
        seen = set()
        max_depth = max(len(r) for r in centroid_ranked) if centroid_ranked else 0
        for depth in range(max_depth):
            for r_list in centroid_ranked:
                if depth < len(r_list):
                    cand = r_list[depth]
                    if cand["id"] not in seen:
                        seen.add(cand["id"])
                        interleaved.append(cand)
                        if len(interleaved) >= top_k:
                            break
            if len(interleaved) >= top_k:
                break
                
        return interleaved[:top_k]

class WeightedNormalizedPersonaBaseline(BaseRecommender):
    """
    Simulates QW3 improved multi-persona clustering:
    - Normalizes embeddings to unit Euclidean length before clustering.
    - Weights samples by max(1.0, plays + 2.5 * reward).
    - Applies Rocchio negative repulsion from disliked tracks.
    - Renormalizes centroids to unit sphere.
    - Round-robin interleaves candidates.
    """
    def __init__(self, seed: int = 42):
        self.seed = seed

    def rank(
        self, 
        user_train: List[Dict[str, Any]], 
        candidates: List[Dict[str, Any]], 
        top_k: int = 15,
        dislikes: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> List[Dict[str, Any]]:
        valid_train = [t for t in user_train if t.get("embedding") is not None]
        if not valid_train:
            return sorted(candidates, key=lambda x: x.get("popularity") or 50, reverse=True)[:top_k]
            
        raw_embs = np.array([t["embedding"] for t in valid_train], dtype=float)
        # L2-normalization
        norms = np.linalg.norm(raw_embs, axis=1, keepdims=True)
        normed_embs = raw_embs / np.maximum(norms, 1e-9)
        
        # Sample weights
        sample_weights = np.array([
            max(1.0, float(t.get("plays", 1)) + 2.5 * float(t.get("reward", 0.0)))
            for t in valid_train
        ], dtype=float)
        
        n = len(normed_embs)
        k = min(3, max(1, n // 2))
        
        if k == 1 or n < 3:
            centroids = [np.average(normed_embs, axis=0, weights=sample_weights)]
        else:
            kmeans = KMeans(n_clusters=k, random_state=self.seed, n_init=10)
            kmeans.fit(normed_embs, sample_weight=sample_weights)
            centroids = [c for c in kmeans.cluster_centers_]
            
        # Rocchio negative repulsion
        if dislikes:
            dislike_embs = [d["embedding"] for d in dislikes if d.get("embedding") is not None]
            if dislike_embs:
                raw_d = np.array(dislike_embs, dtype=float)
                d_norms = np.linalg.norm(raw_d, axis=1, keepdims=True)
                normed_d = raw_d / np.maximum(d_norms, 1e-9)
                dislike_mean = np.mean(normed_d, axis=0)
                centroids = [c - 0.30 * dislike_mean for c in centroids]
                
        # Renormalize centroids to unit sphere
        normed_centroids = []
        for c in centroids:
            cn = np.linalg.norm(c)
            normed_centroids.append(c / cn if cn > 1e-9 else c)
            
        # Per-centroid ranking
        centroid_ranked = []
        for centroid in normed_centroids:
            scored = []
            for cand in candidates:
                c_emb = cand.get("embedding")
                if c_emb is not None:
                    c_arr = np.array(c_emb, dtype=float)
                    c_n = np.linalg.norm(c_arr)
                    c_normed = c_arr / c_n if c_n > 1e-9 else c_arr
                    sim = float(np.dot(centroid, c_normed))
                else:
                    sim = 0.0
                scored.append((sim, cand.get("popularity", 50), cand))
            scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
            centroid_ranked.append([item[2] for item in scored])
            
        # Round-robin interleave
        interleaved = []
        seen = set()
        max_depth = max(len(r) for r in centroid_ranked) if centroid_ranked else 0
        for depth in range(max_depth):
            for r_list in centroid_ranked:
                if depth < len(r_list):
                    cand = r_list[depth]
                    if cand["id"] not in seen:
                        seen.add(cand["id"])
                        interleaved.append(cand)
                        if len(interleaved) >= top_k:
                            break
            if len(interleaved) >= top_k:
                break
                
        return interleaved[:top_k]
