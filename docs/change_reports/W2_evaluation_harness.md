# Change Report: Workstream W2 — Evaluation Harness and Offline Metrics

**Date:** 2026-10-20  
**Status:** Completed  
**Author:** AI Agent (Antigravity)  
**Playbook Reference:** `SOUNDGRAPH_10_OUT_OF_10_AGENT_PLAYBOOK.md` — Workstream W2  

---

## 1. Executive Summary

Workstream W2 establishes the offline evaluation harness and benchmark framework for SoundGraph. Prior to W2, the system had zero automated benchmarking or offline ranking metrics; algorithmic modifications could only be evaluated by manual card inspection (Finding F-03).

With W2 complete:
- An offline evaluation harness (`eval/`) runs deterministically via `python -m eval.run --config config/recsys.yaml`.
- Implements 8 standard ranking and diversity metrics: Recall@K, HitRate@K, NDCG@K, MRR, Coverage@K, Novelty@K (Laplace-smoothed self-information), Intra-List Distance (ILD), and Artist Repeat Rate.
- Implements explicit label discrimination check: pairwise AUC against the 71 `:FEEDBACK` edges in Neo4j.
- Computes 1,000-resample bootstrap 95% confidence intervals (`ci_lower`, `ci_upper`) for headline metrics.
- Evaluates 5 baseline recommendation models: Random, Popularity, SingleMeanCentroid, CurrentMultiPersona, and WeightedNormalizedPersona.
- Automatically generates structured JSON (`docs/benchmarks/w2_baseline_metrics.json`) and Markdown reports (`docs/benchmarks/baseline_report.md`).

---

## 2. Benchmark Baseline Results

Evaluated across the 4 active users with held-out test sets from the 226 verified playable tracks:

| Model | Recall@15 (95% CI) | NDCG@15 (95% CI) | MRR (95% CI) | ILD@15 | Coverage@15 | Explicit AUC |
|---|---|---|---|---|---|---|
| **Random** | 0.075 [0.000, 0.151] | 0.104 [0.000, 0.209] | 0.153 [0.000, 0.375] | 0.223 | 23.9% | 0.498 |
| **Popularity** | 0.280 [0.000, 0.750] | 0.149 [0.000, 0.323] | 0.104 [0.000, 0.208] | 0.196 | 9.3% | 0.441 |
| **SingleMeanCentroid** | 0.719 [0.530, 0.909] | 0.830 [0.610, 0.979] | 0.875 [0.625, 1.000] | 0.149 | 23.9% | 0.504 |
| **CurrentMultiPersona** | 0.636 [0.450, 0.886] | 0.757 [0.589, 0.921] | 0.875 [0.625, 1.000] | 0.164 | 24.3% | 0.526 |
| **WeightedNormalizedPersona** | 0.591 [0.282, 0.900] | 0.592 [0.362, 0.880] | 0.750 [0.500, 1.000] | 0.163 | 23.0% | **0.577** |

---

## 3. Key Findings

1. **Explicit Preference Discrimination (AUC)**:
   - Random scoring achieves **0.498** (exact theoretical coin flip).
   - Popularity sorting achieves **0.441** (popular songs correlate negatively with user's specific explicit likes/dislikes).
   - Multi-persona clustering achieves **0.526**.
   - Weighted normalized personas (QW3) with play-count weighting and Rocchio negative repulsion achieves **0.577**, representing the highest discrimination between liked and disliked tracks.
2. **Diversity vs Accuracy Trade-off**:
   - Single Mean Centroid compresses all user sub-genres into an average vector, lowering intra-list distance (ILD=0.149).
   - Multi-persona clustering expands intra-list diversity (ILD=0.164), delivering distinct aesthetic clusters across card positions.
3. **Small Catalog Bottleneck (F-01)**:
   - With 226 playable tracks and 179 already heard by the primary user, held-out recall is constrained by catalog exhaustion. This confirms Workstream W3 (Catalog Expansion) as the critical next prerequisite.

---

## 4. Verification

- All metric implementations and splitting algorithms verified via 8 automated unit tests in `tests/test_eval_harness.py`.
- Full evaluation suite runs end-to-end via `python -m eval.run --config config/recsys.yaml`.
- Total test suite (25 automated tests across all workstreams) passing cleanly.
