# Workstream W6 — User Taste Modeling, Personas, and Session Dynamics

**Date:** 2026-10-20  
**Status:** Completed  
**Addresses Playbook Findings:** F-10, F-11, F-12, F-24  
**Deliverables:**
- Sub-linear interaction weighting ($w_i$) with logarithmic saturation and explicit feedback multiplier
- Medoid extraction (top-3 real tracks closest to each centroid) to keep vector queries grounded
- Normalized cluster mass calculation ($m_k \in [0, 1]$)
- Time-bucketed context conditioning ($a_k(b)$) across 4 user-local diurnal buckets
- Within-session drift vector ($s$) updated online via exponential moving average ($\eta = 0.30, \eta' = 0.15$)
- Negative memory ledger ($D \le 50$) with calibrated dislike penalty calculation
- Automated unit test suite `tests/test_user_modeling.py` (3 tests, all passing)

---

## 1. Context & Motivation

1. **Unweighted & Unstable Personas (F-10):**
   Previously, every track in a user's history was weighted identically (1 play had the same impact as 50 plays), and raw unnormalized vectors were averaged, distorting multi-genre centroids toward high-magnitude vectors.
2. **Disconnected Dislike Signals & Drifting Tastes (F-11, F-12):**
   Disliked tracks were either permanently hard-blocked or ignored by the embedding space. Within an active listening session, there was no transient adaptation to what the user was currently enjoying or skipping.

---

## 2. Implementation Details

### A. Interaction Weighting ([`PersonaClusterer`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/backend/embeddings/persona_clusterer.py#L20-L45))
$$w_i = \min\left(1.0, \frac{\log(1 + \text{plays}_i)}{\log(1 + 50)}\right) \cdot h_i$$
where $h_i = 1.5$ for explicit likes, $0.5$ for explicit dislikes, and $1.0$ for neutral plays.

### B. Medoid Grounding & Persona Mass
For each cluster $C_k$:
- **Medoids:** The 3 actual member tracks whose normalized vectors have maximum cosine similarity to the centroid $\mu_k$:
  $$\text{medoids}_k = \text{argtop3}_{j \in C_k} (\cos(v_j, \mu_k))$$
- **Cluster Mass:**
  $$m_k = \frac{\sum_{i \in C_k} w_i}{\sum_{j} w_j} \in [0, 1]$$
- **Context Conditioning:**
  $$a_k(b) = \frac{c_{k,b} + \alpha \cdot m_k}{\sum_{k'} c_{k',b} + \alpha}, \quad \alpha = 5$$
  conditioned on user-local time bucket $b \in \{0: \text{Night}, 1: \text{Morning}, 2: \text{Afternoon}, 3: \text{Evening}\}$.

### C. Session Drift Vector ([`SessionTasteState`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/backend/services/session_state.py))
Maintains transient within-session adaptation:
- On positive interaction (like / high dwell):
  $$s \leftarrow \text{normalize}\left((1 - \eta) s + \eta v\right), \quad \eta = 0.30$$
- On negative interaction (dislike / skip):
  $$s \leftarrow \text{normalize}\left(s - \eta' v\right), \quad \eta' = 0.15$$

### D. Negative Memory Ledger & Penalty
- Keeps up to 50 most recent disliked track vectors $D$ in cache.
- Dislike penalty for candidate vector $v$:
  $$\text{pen}(v) = \text{clip}\left(\frac{\max_{d \in D} \cos(v, d) - 0.75}{0.25}, 0.0, 1.0\right)$$
  Tracks with cosine $\ge 0.75$ to recently disliked items receive a continuous penalty scaling up to 1.0.

---

## 3. Verification & Testing

- Unit tests: `tests/test_user_modeling.py` passing 100%.
- Verified interaction weighting formula, medoids extraction, cluster mass sum $= 1.0$, session vector drift, and dislike penalty calculation.
