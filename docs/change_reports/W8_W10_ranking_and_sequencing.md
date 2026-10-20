# Workstream W8 & W10 — Pointwise Ranking, Diversity (MMR), and Deck Arc Sequencing

**Date:** 2026-10-20  
**Status:** Completed  
**Addresses Playbook Findings:** F-07, F-13, F-15, F-32  
**Deliverables:**
- Pointwise Multi-Signal Ranker ([`PointwiseRanker`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/backend/ranking/pointwise_ranker.py)) combining 8 explicit signals
- Calibrated soft mood filter ($\text{mood\_match} \times \text{conf}$) replacing arbitrary binary cutoffs
- Maximal Marginal Relevance ([`DeckSequencer`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/backend/ranking/deck_sequencer.py)) with hard artist cap ($\le 2$ tracks per artist) and cluster cap ($\le 50\%$)
- Deck Arc Sequencing (exploit hooks at slots 1-2 & 15, explore slots at 5, 9, 13)
- Fully passing unit test suite `tests/test_ranker_and_sequencing.py` (4 tests)

---

## 1. Context & Motivation

1. **Missing Middle Ranking Stage (F-07):**
   Previously, there was no unified ranking model between candidate retrieval and card serving. Tracks were sorted merely by arbitrary combinations of cosine score and popularity.
2. **Binary Mood Starvation (F-32):**
   Hard mood filters (`valence >= 0.55`, `energy <= 0.55`) caused extreme card starvation and rejected otherwise perfect tracks that missed the threshold by 0.01.
3. **Monopolized Decks & Artist Fatigue (F-13):**
   High-scoring popular artists would often occupy 5+ consecutive cards in a 15-card deck, destroying discovery and listener trust.

---

## 2. Implementation Details

### A. Pointwise Multi-Signal Scoring (W8 Phase 1)
For every candidate track $d$:
$$\text{score}(d) = 1.00 \cdot \text{sim\_persona}(d) + 0.80 \cdot \text{sim\_session}(d) + 0.30 \cdot \text{pop\_pct}(d) + 0.25 \cdot \text{novelty}(d) + 0.20 \cdot (\text{mood\_match}(d) \cdot \text{conf}(d)) + 0.10 \cdot \text{source\_prior}(d) - 0.80 \cdot \text{pen}(d) - 0.50 \cdot (1 - \text{preview\_conf}(d))$$

- **Calibrated Soft Mood Match:**
  $$\text{dist} = \sqrt{(\text{valence} - v^*)^2 + (\text{energy} - e^*)^2}$$
  $$\text{mood\_match} = \max(0, 1 - 1.2 \cdot \text{dist}) \cdot \text{feature\_confidence}$$
  Smoothly scales relevance according to acoustic proximity to target coordinates without binary rejections.

### B. Maximal Marginal Relevance (MMR) & Hard Constraints (W10)
Iterative greedy selection:
$$\text{next} = \text{argmax}_{d \in C \setminus S} \left[ \lambda \cdot \text{score}(d) - (1 - \lambda) \cdot \max_{s \in S} \text{sim}(d, s) \right], \quad \lambda = 0.70$$
$$\text{sim}(d, s) = \cos(v_d, v_s) + 0.50 \cdot \mathbf{1}_{\{\text{artist}(d) = \text{artist}(s)\}}$$
- **Hard Artist Cap:** At most 2 tracks per artist across the entire deck.
- **Hard Cluster Cap:** At most 8 tracks ($\le 50\%$) from any single persona cluster.

### C. Deck Arc Sequencing
Sequences the 15-card deck for optimal engagement and discovery:
- **Positions 1 & 2 (Cards 1-2):** High-confidence exploit hooks to instantly hook the user.
- **Positions 5, 9, 13 (Cards 5, 9, 13):** Discovery and exploratory tracks spaced across the session.
- **Position 15 (Card 15):** Strong exploit closer track.
- **Audio Transitions:** Passed through [`AIFlowChainer`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/backend/audio/flow_chainer.py) for harmonic key/tempo alignment.

---

## 3. Verification & Testing

- Unit tests: `tests/test_ranker_and_sequencing.py` passing 100%.
- Verified score component breakdown, soft mood weighting, artist cap enforcement ($\le 2$ tracks), deck arc positioning, and live Neo4j end-to-end integration.
- Full regression suite: **46 tests passing** (100%).
