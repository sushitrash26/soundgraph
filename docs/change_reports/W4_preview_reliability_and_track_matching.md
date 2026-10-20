# Change Report — W4: Preview Reliability and Track Matching (plus Quick Win QW1)

**Date:** 2026-10-20  
**Workstream:** W4  
**Author:** AI Agent (Antigravity)  
**Status:** Complete

---

### 1. What Changed
* **New Service (`backend/services/preview_service.py`)**:
  * Implemented `TokenBucketRateLimiter`: Enforces 20 requests/minute to respect iTunes Search API quotas.
  * Implemented `PreviewVerifier`: Strict range-GET probe (`bytes=0-1024`) validating HTTP 200/206, `audio/*` content type, allowlisted hosts (`audio-ssl.itunes.apple.com`, `cdns-preview-*.dzcdn.net`, `p.scdn.co`), plausible file size (>100 KB), and rejecting YouTube HTML pages.
  * Implemented `PreviewResolver`: Multi-factor candidate scoring (`0.45*title + 0.35*artist + 0.15*duration + 0.05*album`) with $-0.25$ version penalties (`live`, `acoustic`, `remix`, `slowed`, `cover`, `karaoke`, `instrumental`). Implemented Deezer Search fallback.
* **Catalog Reconciliation (`scratch/reconcile_catalog_previews.py`)**:
  * Reconciled all 332 tracks in Neo4j.
  * Verified 156 existing iTunes preview tracks.
  * Successfully resolved and verified 70 additional tracks from iTunes studio previews ($conf \ge 0.80$).
  * Flagged 106 unresolvable tracks (gaming videos, YouTube non-music content, missing metadata) with `preview_status = 'failed'`.
* **Serve-Time Playability Guard (`backend/graph/queries.py`)**:
  * Added `AND coalesce(rec.preview_status, 'failed') = 'ok'` to all 4 recommendation tiers (Persona Exploitation, Frontier Wildcards, Graph Similarity, Catalog Diversity).
* **Quick Win QW1 Learning Guard (`backend/graph/queries.py`)**:
  * Added playability checks in `record_feedback` and `record_dwell_telemetry`. Swipes or dwell events on unplayable or non-existent tracks are cleanly dropped (`{"status": "ignored"}`) without corrupting user bandit profiles.
* **Test Suite (`tests/test_preview_service.py`)**:
  * 6 automated tests passing: token similarity, version penalties, host rejection, host acceptance, zero-silent-cards deck invariant, and QW1 learning guard.

---

### 2. Why (Findings Addressed)
* **F-08**: Solved silent cards problem. Previously only 156 of 332 tracks (47.0%) had playable previews, while 133 tracks had YouTube web links that could not play audio in-app.
* **F-17**: Eliminated naive `limit=1` iTunes matching. Added token-set scoring, duration delta penalties, and version-specific deductions.
* **F-28**: Replaced weak HTTP 200 check with strict `audio/*` mime-type, range verification, and host allowlist.
* **QW1**: Prevented unplayable card interactions from writing false dislikes and bandit penalties.

---

### 3. Baseline vs After (Empirical Measurements)

| Metric | Baseline (Pre-W4) | After W4 Implementation | Delta |
|---|---|---|---|
| **Verified Playable Tracks** | 156 / 332 (47.0%) | **226 / 332 (68.1%)** | **+70 tracks (+44.9% relative increase)** |
| **Failed / Isolated Tracks** | 176 (53.0%) | **106 (31.9%)** | **-70 unplayable tracks** |
| **Serve-Time Playability** | ~47% (silent cards served) | **100.0% by construction** | **Silent cards eliminated** |
| **In-App Deck Audio Reliability** | Frequent failures / YouTube bounces | **15 of 15 cards stream studio AAC** | **Zero silent cards served** |
| **Silent Card Feedback Corruption** | Active (false dislikes recorded) | **0 (Dropped by QW1 guard)** | **Taste profiles protected** |

---

### 4. What Did NOT Improve or Got Worse
* 106 tracks remain marked `preview_status = 'failed'` in the database. These are largely YouTube non-music videos (e.g. PC building videos, reaction edits, or songs with non-standard uploader names) that will be handled in the Data Hygiene step of W3.
* Total playable catalog is currently 226 tracks. Because active users have already heard up to 179 tracks, catalog expansion (W3) is essential to unlock discovery.

---

### 5. Docs Updated
* [`DECISIONS.md`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/DECISIONS.md) (Appended D-0019)
* [`docs/RECSYS.md`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/docs/RECSYS.md) (Updated W4 and QW1 to `[IMPLEMENTED]`)
* [`config/recsys.yaml`](file:///run/media/sushitrash26/New%20Volume/GENAI/17thOct/soundgraph/config/recsys.yaml) (Created single source of truth configuration)

---

### 6. Flags and Rollback
* Changes in `queries.py` sit behind `coalesce(rec.preview_status, 'failed') = 'ok'`.
* Rollback command: `git checkout HEAD~1 -- backend/graph/queries.py`

---

### 7. Open Questions for the Owner
* None. All W4 decisions confirmed in D-0019.

---

### 8. Next Workstream Proposal
* Per the Revised Phase A order in Appendix D.2:
  * Next is **W1 — Impression and Event Log** (persisting `requests`, `impressions`, and `events` in SQLite/Postgres to enable offline replay, evaluation harness W2, and debiased bandit learning).
