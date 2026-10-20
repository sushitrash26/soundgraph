# Workstream W7 — Graph Topology Pruning and Candidate Fusion

**Date:** 2026-10-20  
**Status:** Completed  
**Addresses Playbook Findings:** F-05, F-07, F-22  
**Deliverables:**
- Deletion of 35,099 spurious non-Track `SIMILAR_TO` edges
- Deduplication of 531 parallel track-to-track `SIMILAR_TO` edges
- Mutual top-10 degree bounding per track tagged with `source = 'hnsw_pruned'`
- Implementation of Reciprocal Rank Fusion (`ReciprocalRankFuser`) in `backend/graph/candidate_fusion.py`
- End-to-end integration into `GraphQueries.get_recommendations` eliminating waterfall scale mismatches
- Comprehensive unit test suite `tests/test_candidate_fusion.py` (3 tests, all passing)

---

## 1. Context & Motivation

1. **Unbounded Spurious Graph Edges (F-07):**
   The graph had accumulated 43,432 `SIMILAR_TO` edges, of which **35,099 were non-track relationships** (connecting Tracks to Artists, Tracks to Genres, Artists to Artists, and Genres to Genres).
   Furthermore, track-to-track relationships had up to 35 parallel duplicate edges per pair with degree up to 380.
2. **Scale Mismatches & Waterfall Starvation (F-05, F-22):**
   `get_recommendations` previously relied on an ad-hoc waterfall where `SIMILAR_TO` and `catalog` fallback queries were only executed if the persona query starved (<15 results). When they did execute, raw cosine similarity scores, graph edge weights, and hardcoded numbers (0.78, 0.85) were mixed arbitrarily.

---

## 2. Graph Topology Pruning (`scratch/prune_graph_topology.py`)

| Metric | Before Pruning | After Pruning | Change |
|---|---|---|---|
| **Total `SIMILAR_TO` Edges** | 43,432 | **2,117** | **-95.1%** |
| **Non-Track `SIMILAR_TO` Edges** | 35,099 | **0** | **-100.0% (Clean)** |
| **Track-to-Track Edges** | 8,333 | **2,117** | **-74.6%** |
| **Duplicate Parallel Pairs** | 531 pairs | **0** | **-100.0%** |
| **Max Degree per Track** | 380 | **10** | **Bounded to Top-10** |
| **Average Degree per Track** | 55.39 | **8.61** | **Clean graph structure** |
| **Edge Source Property** | `None` | `'hnsw_pruned'` | **Auditable provenance** |

---

## 3. Reciprocal Rank Fusion Design (`backend/graph/candidate_fusion.py`)

Heterogeneous candidate sources are fused via reciprocal rank fusion:
$$RRF(d) = \sum_{s \in \text{Sources}} \frac{w_s}{k_{\text{rrf}} + \text{rank}_s(d)}$$
where $k_{\text{rrf}} = 60$.

### Default Source Weights
- `persona_text`: **1.0** (HNSW vector retrieval across taste persona centroids and medoids with adaptive over-fetch $k_{\text{fetch}} \ge 200$)
- `similar_to`: **0.6** (Bounded graph similarity from user's listened tracks)
- `catalog`: **0.3** (Global catalog diversity and popularity)

### Key Properties
- **No scale mixing:** Candidate ranking is purely determined by relative ranks within honest retrieval channels.
- **Overlap boost:** A track surfaced by both `persona_text` and `similar_to` receives contributions from both channels and outranks single-source candidates.
- **Accurate arm attribution:** Dominant source is tracked and assigned to LinUCB bandit arm (`persona_exploit` = 0, `graph_similarity` = 1, `catalog_diversity` = 2, `frontier_wildcard` = 3).
- **Candidate count transparency:** True candidate counts per source are logged to the impression ledger.

---

## 4. Verification & Testing

- Unit tests: `tests/test_candidate_fusion.py` (3 tests)
- Regression suite: 39 tests passing (100%)
