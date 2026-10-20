# Change Report — W0: Ground Truth and Doc Sync

**Date:** 2026-10-20  
**Workstream:** W0  
**Author:** AI Agent (Antigravity)  
**Status:** Complete

---

### 1. What Changed
* **Decision Log**: Created [`DECISIONS.md`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/DECISIONS.md) recording 18 architectural, infrastructure, and policy decisions approved by the owner across Blocks A, B, C, D, and Quick Wins QW1–QW6.
* **Diagnostics Suite**: Created and executed [`scratch/run_full_w0_diagnostics.py`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/scratch/run_full_w0_diagnostics.py) against live Neo4j and Redis. Generated diagnostic artifacts:
  * [`docs/diagnostics/2026-10-20/w0_diagnostics_report.json`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/docs/diagnostics/2026-10-20/w0_diagnostics_report.json)
  * [`docs/diagnostics/2026-10-20/d07_youtube_audit_sample.csv`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/docs/diagnostics/2026-10-20/d07_youtube_audit_sample.csv) (50-track sample for YouTube migration verification)
* **Current State Documentation**: Created [`docs/CURRENT_STATE.md`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/docs/CURRENT_STATE.md) with line-by-line verification of the 15 checklist items (V1–V15).
* **System Specification Sync**: Created [`docs/RECSYS.md`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/docs/RECSYS.md) replacing ungrounded claims with rigorous status tags (`[IMPLEMENTED]`, `[PARTIAL]`, `[PLANNED]`).

---

### 2. Why (Findings Addressed)
* **F-09**: Design doc and codebase had drifted significantly (claims of RAG generation, key-aware harmonic flow, and RLHF did not match actual code).
* **F-26**: Replaced all ungrounded estimates with empirically measured numbers from live database queries and HTTP probes.
* **F-05 & V14**: Reconciled the 43,432 `SIMILAR_TO` edge count, discovering that GDS wrote edges across all node types and produced up to 35 parallel duplicate edges on track pairs.
* **F-08 & V12**: Discovered that 133 YouTube web URLs (40.1% of the catalog) bypass the native audio player in `mobile/src/store/useMobileStore.js:636`, reducing true playable audio preview coverage to 47.0%.

---

### 3. Baseline vs After (Empirical Measurements)

| Metric / Dimension | Baseline Perception (Design Doc) | Measured Ground Truth (W0 Audit) |
|---|---|---|
| **Catalog Size** | Generic multi-thousand | **332 tracks**, 266 artists, 6 users |
| **User Overlap** | Multiple distinct beta users | **Effective N=1 user** (92.7% overlap between `astitva_demo_user` and `google:...4439`) |
| **Catalog Coverage** | Unmeasured | **53.9% of catalog already listened** to by primary user |
| **Strict Playable Audio** | "All tracks have previews" | **156 of 332 tracks (47.0%)** have verified iTunes audio streams; 43 null, 133 YouTube web links |
| **Acoustic Energy Distribution** | Balanced [0, 1] | **75.2% compressed in [0.40, 0.60]** ($\mu=0.55, \sigma=0.11$) |
| **Acoustic Valence Distribution** | Balanced [0, 1] | **57.6% compressed in [0.40, 0.50]** ($\mu=0.46, \sigma=0.11$) |
| **SIMILAR_TO Edges** | 43k Track-Track edges | **8,333 Track-Track edges** (3,115 distinct pairs, max parallel = 35); 85 isolated tracks (25.6%) |
| **Artist Diversity in Decks** | Diverse | **Up to 4 tracks by the same artist** per 15-track deck; 3–5 duplicate slots |
| **Bandit Integration** | Active serve-time LinUCB | **Waterfall fallback only**; arms statically tagged by tier; LinUCB not in serve path |

---

### 4. What Did NOT Improve or Got Worse
* No code changes were made to backend algorithms in W0 (pure measurement and doc synchronization phase).
* Exposing the 47% playable preview ceiling highlights that playability (W4) is the most urgent blocker before catalog expansion or ranking changes.

---

### 5. Docs Updated
* [`DECISIONS.md`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/DECISIONS.md) (Created)
* [`docs/CURRENT_STATE.md`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/docs/CURRENT_STATE.md) (Created)
* [`docs/RECSYS.md`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/docs/RECSYS.md) (Created)
* [`docs/diagnostics/2026-10-20/w0_diagnostics_report.json`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/docs/diagnostics/2026-10-20/w0_diagnostics_report.json) (Generated)
* [`docs/diagnostics/2026-10-20/d07_youtube_audit_sample.csv`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/docs/diagnostics/2026-10-20/d07_youtube_audit_sample.csv) (Generated)

---

### 6. Flags and Rollback
* Additive documentation and diagnostic outputs only. Zero risk of production regression.
* Rollback command: `git checkout HEAD -- docs/ DECISIONS.md`

---

### 7. Open Questions for the Owner
* None. All Phase-0 questions (Q-A1 to Q-D4) are confirmed in `DECISIONS.md`.

---

### 8. Next Workstream Proposal
* Per the Revised Phase A order in Appendix D.2:
  1. **Execute W4 first (Preview Reliability and Track Matching)**: Enforce strict `audio/*` allowlist, resolve working iTunes preview URLs for the 176 silent/YouTube tracks, and guarantee zero silent cards served to the client.
  2. Implement Quick Win **QW1** (stop learning from silent card swipes).
