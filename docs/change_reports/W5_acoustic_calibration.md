# Workstream W5 Part A — Acoustic Feature Calibration and Source Tagging

**Date:** 2026-10-20  
**Status:** Completed  
**Addresses Playbook Findings:** F-06, F-21, F-31, F-32  
**Deliverables:**
- Multi-anchor ensemble (5 bipolar pairs per feature) for differential semantic projection
- Empirical percentile ranking across catalog mapping features to $[0.01, 0.99]$
- Rigorous validation against 28 Spotify ground-truth tracks with Spearman $\rho$ and 95% bootstrap CIs
- Source and confidence tagging (`feature_source`: `'spotify'` | `'text_proxy'`, `feature_confidence`: $1.0$ vs $0.65$)
- Circularity removal: Embedding text v2 format without numeric feature strings
- Fully passing unit test suite `tests/test_feature_calibrator.py`

---

## 1. Context & Motivation

In the original codebase:
- Most tracks had synthesized features from a single bipolar anchor pair, causing extreme compression into $[0.40, 0.60]$ (F-06).
- Mood filters selected highly skewed subsets of the catalog (valence $\ge 0.55 \approx 19\%$, energy $\le 0.55 \approx 56\%$) (F-32).
- Embedding text appended predicted numeric floats (`f"energy intensity: {features['energy']:.2f}"`), causing circularity (F-21).
- No tracks were tagged with their feature source or confidence score.

---

## 2. Implementation Details

### A. Multi-Anchor Ensemble (`backend/services/feature_calibrator.py`)
For each of `energy`, `valence`, `danceability`, and `acousticness`, 5 distinct pairs of polar descriptions were curated and embedded via Gemini 768-D. For a track vector $e$:
$$s_j = \cos(e, \text{pos}_j) - \cos(e, \text{neg}_j)$$
$$\text{raw} = \frac{1}{5}\sum_{j=1}^5 s_j$$

### B. Catalog Percentile Ranking
Across the 654 catalog tracks, raw differential scores are ranked into empirical percentiles:
$$\text{percentile} = \text{clip}\left(\frac{\text{rank}(\text{raw}) - 0.5}{N}, 0.01, 0.99\right)$$
This spreads the proxy values uniformly across $[0.01, 0.99]$, ensuring mood and energy filters work symmetrically.

### C. Ground Truth Validation & Confidence Intervals
Validated against the $N = 28$ tracks with verified Spotify ground truth (`tempo IS NOT NULL`):
- **Energy:** $\rho = +0.758$ ($p = 0.0000$), $95\%$ bootstrap CI: $[+0.550, +0.891]$
- **Valence:** $\rho = +0.526$ ($p = 0.0040$), $95\%$ bootstrap CI: $[+0.065, +0.855]$
- **Danceability:** $\rho = +0.664$ ($p = 0.0001$), $95\%$ bootstrap CI: $[+0.405, +0.836]$
- **Acousticness:** $\rho = +0.605$ ($p = 0.0011$), $95\%$ bootstrap CI: $[+0.227, +0.864]$

All four features exhibit statistically significant positive correlation with real acoustic measurements.

### D. Source & Confidence Tagging
In Neo4j:
- 28 Spotify tracks tagged with `feature_source = 'spotify'`, `feature_confidence = 1.0` (preserving their exact measurements).
- 626 text proxy tracks tagged with `feature_source = 'text_proxy'`, `feature_confidence = 0.65`, calibrated percentile features, and raw scores stored in `energy_raw`, `valence_raw`, `danceability_raw`, `acousticness_raw`.

### E. Circularity Removal (Embedding Text v2)
In `backend/embeddings/gemini_embedder.py`:
Updated `build_track_semantic_description` to clean natural language v2:
`"{name} by {artists}. Album: {album}. Genres and tags: {genres}."`
Completely eliminated numeric feature strings from the text embedding pipeline.

---

## 3. Calibrated Catalog Distribution

| Feature | Min | p25 | Mean | Median | p75 | Max |
|---|---|---|---|---|---|---|
| **Energy** | 0.010 | 0.289 | 0.525 | 0.537 | 0.768 | 0.990 |
| **Valence** | 0.010 | 0.292 | 0.519 | 0.520 | 0.755 | 0.990 |
| **Danceability** | 0.010 | 0.283 | 0.518 | 0.529 | 0.755 | 0.990 |
| **Acousticness** | 0.010 | 0.235 | 0.489 | 0.489 | 0.738 | 0.990 |

---

## 4. Verification & Testing

- Unit tests: `tests/test_feature_calibrator.py` (4 tests)
- Full regression suite: 36 tests passing (100%)
