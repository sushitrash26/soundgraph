import math
import numpy as np
from typing import List, Set, Dict, Any, Tuple, Optional

def recall_at_k(ranked_ids: List[str], relevant_ids: Set[str], k: int = 15) -> float:
    if not relevant_ids:
        return 0.0
    top_k = set(ranked_ids[:k])
    return len(top_k & relevant_ids) / float(len(relevant_ids))

def hit_rate_at_k(ranked_ids: List[str], relevant_ids: Set[str], k: int = 15) -> float:
    if not relevant_ids:
        return 0.0
    top_k = set(ranked_ids[:k])
    return 1.0 if len(top_k & relevant_ids) > 0 else 0.0

def ndcg_at_k(ranked_ids: List[str], relevant_ids: Set[str], k: int = 15) -> float:
    if not relevant_ids:
        return 0.0
    dcg = 0.0
    for i, item_id in enumerate(ranked_ids[:k]):
        if item_id in relevant_ids:
            dcg += 1.0 / math.log2(i + 2)  # i+2 because i is 0-indexed, so pos is i+1, log2(pos+1)=log2(i+2)
    
    idcg = 0.0
    ideal_hits = min(k, len(relevant_ids))
    for i in range(ideal_hits):
        idcg += 1.0 / math.log2(i + 2)
    
    return dcg / idcg if idcg > 0 else 0.0

def mrr(ranked_ids: List[str], relevant_ids: Set[str]) -> float:
    if not relevant_ids:
        return 0.0
    for i, item_id in enumerate(ranked_ids):
        if item_id in relevant_ids:
            return 1.0 / float(i + 1)
    return 0.0

def coverage_at_k(user_recommendations: Dict[str, List[str]], catalog_ids: Set[str], k: int = 15) -> float:
    if not catalog_ids:
        return 0.0
    recommended_set: Set[str] = set()
    for recs in user_recommendations.values():
        recommended_set.update(recs[:k])
    return len(recommended_set & catalog_ids) / float(len(catalog_ids))

def novelty_at_k(ranked_ids: List[str], track_user_counts: Dict[str, int], total_users: int, k: int = 15) -> float:
    """Computes mean self-information -log2(p(i)) using Laplace smoothed track user fraction."""
    if not ranked_ids or total_users <= 0:
        return 0.0
    items = ranked_ids[:k]
    if not items:
        return 0.0
    info_sum = 0.0
    for tid in items:
        # Laplace smoothed probability
        count = track_user_counts.get(tid, 0)
        p = (count + 1.0) / (total_users + 2.0)
        info_sum += -math.log2(p)
    return info_sum / len(items)

def intra_list_distance(ranked_embeddings: List[np.ndarray], k: int = 15) -> float:
    """Computes mean pairwise cosine distance 1 - cos(v_i, v_j) among top-k recommendations."""
    vectors = [v for v in ranked_embeddings[:k] if v is not None and len(v) > 0]
    n = len(vectors)
    if n < 2:
        return 0.0
    
    # Normalize vectors
    norms = [np.linalg.norm(v) for v in vectors]
    normed = [v / nrm if nrm > 1e-9 else v for v, nrm in zip(vectors, norms)]
    
    dist_sum = 0.0
    pair_count = 0
    for i in range(n):
        for j in range(i + 1, n):
            sim = float(np.dot(normed[i], normed[j]))
            dist = 1.0 - max(-1.0, min(1.0, sim))
            dist_sum += dist
            pair_count += 1
            
    return dist_sum / pair_count if pair_count > 0 else 0.0

def artist_repeat_rate(ranked_artists: List[List[str]], k: int = 15) -> float:
    """Computes 1 - (unique artists / total artist appearances) in top-k deck."""
    items = ranked_artists[:k]
    if not items:
        return 0.0
    all_artists = []
    for art_list in items:
        all_artists.extend(art_list if isinstance(art_list, list) else [str(art_list)])
    if not all_artists:
        return 0.0
    unique_artists = len(set(all_artists))
    return 1.0 - (float(unique_artists) / len(all_artists))

def compute_auc(positive_scores: List[float], negative_scores: List[float]) -> float:
    """Computes AUC = P(score(liked) > score(disliked)) via exact pairwise Mann-Whitney U comparison."""
    if not positive_scores or not negative_scores:
        return 0.5
    wins = 0.0
    ties = 0.0
    for p in positive_scores:
        for n in negative_scores:
            if p > n:
                wins += 1.0
            elif p == n:
                ties += 0.5
    total = len(positive_scores) * len(negative_scores)
    return (wins + ties) / float(total) if total > 0 else 0.5

def bootstrap_ci(values: List[float], n_bootstrap: int = 1000, ci: float = 0.95, seed: int = 42) -> Dict[str, float]:
    """Computes empirical mean and bootstrap percentile confidence interval."""
    if not values:
        return {"mean": 0.0, "ci_lower": 0.0, "ci_upper": 0.0}
    arr = np.array(values, dtype=float)
    if len(arr) == 1:
        return {"mean": float(arr[0]), "ci_lower": float(arr[0]), "ci_upper": float(arr[0])}
    
    rng = np.random.default_rng(seed)
    indices = rng.integers(0, len(arr), size=(n_bootstrap, len(arr)))
    boot_means = np.mean(arr[indices], axis=1)
    
    alpha = (1.0 - ci) / 2.0
    lower = float(np.percentile(boot_means, alpha * 100.0))
    upper = float(np.percentile(boot_means, (1.0 - alpha) * 100.0))
    return {
        "mean": float(np.mean(arr)),
        "ci_lower": lower,
        "ci_upper": upper
    }
