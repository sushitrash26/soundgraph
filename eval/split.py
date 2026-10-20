import random
from typing import List, Dict, Any, Tuple

def temporal_split(
    history: List[Dict[str, Any]], 
    test_frac: float = 0.20, 
    min_test: int = 5, 
    seed: int = 42
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Splits user listening history into train (80%) and test (20%).
    
    If timestamps are distinct, uses chronological ordering (train = first 80%, test = last 20%).
    If timestamps are identical or non-differentiating (V6 batch sync caveat), falls back to 
    a deterministic seeded random split and preserves item identity.
    """
    if not history:
        return [], []
    if len(history) < 2:
        return list(history), []
        
    n = len(history)
    n_test = max(1, int(round(n * test_frac)))
    if n >= min_test * 2:
        n_test = max(min_test, n_test)
    n_test = min(n - 1, n_test)  # Ensure at least 1 item in train
    
    # Check timestamp diversity
    timestamps = [h.get("last_played") or h.get("timestamp") or h.get("first_played") for h in history]
    valid_ts = [t for t in timestamps if t is not None]
    distinct_ts = len(set(valid_ts))
    
    # If we have genuine timestamp diversity across >= 50% of the history
    if distinct_ts >= max(3, len(valid_ts) * 0.5):
        # Sort chronologically
        sorted_history = sorted(
            history, 
            key=lambda x: str(x.get("last_played") or x.get("timestamp") or x.get("first_played") or "")
        )
        train = sorted_history[:-n_test]
        test = sorted_history[-n_test:]
    else:
        # Fall back to seeded random split for batch-synced libraries
        rng = random.Random(seed)
        shuffled = list(history)
        rng.shuffle(shuffled)
        train = shuffled[:-n_test]
        test = shuffled[-n_test:]
        
    return train, test
