# SoundGraph — Decision Log (`DECISIONS.md`)

This file records all architectural, data, and policy decisions confirmed by the project owner in accordance with the `SOUNDGRAPH_10_OUT_OF_10_AGENT_PLAYBOOK.md`.

---

## D-0001 — Beta Scale and Target Horizon (2026-10-20, Phase 0 / W0)
- **Question asked:** Who will use the beta in the next 3 months, and roughly how many people? (Q-A1)
- **Options considered:**
  - A) Assume 20–50 users for beta, design logging and capacity for 1,000 (Recommended)
  - B) Personal / internal use only (1–5 users)
  - C) Large public beta (>100 active users in the next month)
- **Owner's answer:** A) 20–50 users for beta; design logging and capacity for 1,000.
- **Consequences / follow-ups:** System will be sized for a growing beta up to 1,000 users. Relational event logging must scale smoothly without impacting latency.
- **Reversible?** Yes, capacity limits are adjustable in config.

---

## D-0002 — Discovery Definition in Headline Metric (2026-10-20, Phase 0 / W0)
- **Question asked:** How should "discovery" be counted in the headline Novel-Liked per Deck (NLD) metric? (Q-A2)
- **Options considered:**
  - A) Report both: Strict (never-heard track AND artist) and Loose (never-heard track) (Recommended)
  - B) Strict only (never-heard track AND artist)
  - C) Loose only (any track user hasn't heard)
  - D) Persona novelty (outside top clusters)
- **Owner's answer:** A) Report both Strict and Loose metrics side-by-side in all eval reports.
- **Consequences / follow-ups:** Metric reporting will calculate both:
  - `NLD_strict`: cards where neither track nor artist were previously listened to by user.
  - `NLD_loose`: cards where track_id was not previously listened to by user.
- **Reversible?** Yes, both can be computed from the event log.

---

## D-0003 — Familiar Tracks Quota in Decks (2026-10-20, Phase 0 / W0)
- **Question asked:** May recommendation decks contain familiar tracks (resurface old favourites)? (Q-A3)
- **Options considered:**
  - A) Yes: 1–2 of 15 slots (up to 5 for "Familiar" mode), tracked as separate arm and excluded from NLD (Recommended)
  - B) No: 100% pure discovery
  - C) Higher familiar share (3–4 tracks default)
- **Owner's answer:** A) 1–2 of 15 slots allocated to resurface arm, excluded from NLD discovery calculation.
- **Consequences / follow-ups:** W6 item 9 and W9 Arm A3 will implement resurfacing logic for tracks with play_count ≥ 3 or liked, last_played ≥ 45 days ago.
- **Reversible?** Yes, controlled by `diversity.resurface_slots` in `config/recsys.yaml`.

---

## D-0004 — Target Metrics Definition of 10/10 (2026-10-20, Phase 0 / W0)
- **Question asked:** Accept the targets in §3, or change any? (Q-A4)
- **Options considered:**
  - A) Accept all §3 targets (Recommended)
  - B) Modify targets
- **Owner's answer:** A) Accepted §3 targets:
  - Playability: ≥ 99.5% with 0 silent cards
  - Discovery: NLD ≥ 3.0 / 15
  - Engagement: Like rate ≥ 40%, Early-skip rate ≤ 25%
  - Diversity: ≤ 2 tracks per artist, ≥ 12 unique artists per 15-card deck
  - Retrieval: Multi-persona beats mean centroid by ≥ 10% relative recall@15 (95% CI > 0)
  - Catalog: ≥ 15,000 playable tracks, ≥ 90% audio-derived features
  - Latency: P95 < 250 ms
- **Consequences / follow-ups:** All workstream acceptance criteria are bound to these numerical targets.
- **Reversible?** Targets can be refined as catalog and user volume expand.

---

## D-0005 — Timeline and Milestone Cadence (2026-10-20, Phase 0 / W0)
- **Question asked:** Any deadline (demo, launch)? (Q-A5)
- **Owner's answer:** Execute immediately and systematically following Phases A → D without artificial deadlines.
- **Consequences / follow-ups:** Workstreams W0 through W13 will be completed in strict dependency order.
- **Reversible?** N/A.

---

## D-0006 — Event & Impression Log Datastore (2026-10-20, Phase 0 / W1)
- **Question asked:** What relational store should we use for impression and event logs? (Q-B1)
- **Owner's answer:** SQLite file for local dev / testing, with PostgreSQL migration schema ready for hosted deployment. Do not store events as Neo4j nodes.
- **Consequences / follow-ups:** W1 implementation will use SQLAlchemy/SQLite with dual SQLite/PostgreSQL DDL (`requests`, `impressions`, `events`).
- **Reversible?** Yes, ORM allows switching dialect via `DATABASE_URL`.

---

## D-0007 — Neo4j AuraDB Capacity & SIMILAR_TO Policy (2026-10-20, Phase 0 / W3, W7)
- **Question asked:** Does AuraDB Free stay, or is there budget to upgrade? (Q-B2)
- **Owner's answer:** Stay on AuraDB Free (200k nodes / 400k relationships). Keep relationships bounded by removing materialised embedding `SIMILAR_TO` edges.
- **Consequences / follow-ups:** Vector similarity will rely directly on the 768-D HNSW vector index (`track_embeddings`) rather than bloating the graph with pairwise `SIMILAR_TO` edges.
- **Reversible?** Yes.

---

## D-0008 — Compute Budget and API Quotas (2026-10-20, Phase 0 / W3, W5)
- **Question asked:** Budget and compute: Gemini paid tier? Last.fm key? CPU-only or GPU for audio extraction? (Q-B3)
- **Owner's answer:** Free tiers (Gemini free tier, Last.fm free key, CPU batch workers).
- **Consequences / follow-ups:** Ingestion queues must implement strict rate-limiting (Gemini 15 RPM) and batching with exponential backoff.
- **Reversible?** Yes, worker concurrency and batch sizes are configurable.

---

## D-0009 — Mobile Client Telemetry Contract (2026-10-20, Phase 0 / W1, W4)
- **Question asked:** Can the mobile client change (send `impression_id`, playback events, preview errors)? (Q-B4)
- **Owner's answer:** Yes via Expo; maintain backward compatibility for existing endpoints.
- **Consequences / follow-ups:** Backend will accept optional `impression_id` on `/feedback` and `/telemetry/dwell`, while adding `/events` batch ingestion.
- **Reversible?** Yes, legacy parameters will remain supported.

---

## D-0010 — Test Infrastructure and CI (2026-10-20, Phase 0 / W2, W12)
- **Question asked:** Is there a staging DB and CI? (Q-B5, Q-D1)
- **Owner's answer:** Pytest suite with GitHub Actions CI workflow running the offline eval regression snapshot.
- **Consequences / follow-ups:** W2 will build `eval/` with deterministic, seeded evaluation and snapshot tests.
- **Reversible?** Yes.

---

## D-0011 — Spotify Audio Features Availability (2026-10-20, Phase 0 / W5)
- **Question asked:** Can we assume Spotify audio-features endpoint is unavailable for new tracks? (Q-C1)
- **Owner's answer:** Yes, assume Spotify audio features are unavailable for all new tracks; rely on iTunes/Deezer/native audio pipeline.
- **Consequences / follow-ups:** Ingestion will not depend on Spotify Web API for new songs.
- **Reversible?** Yes, if Spotify developer credentials allow it later.

---

## D-0012 — Preview Audio Processing Posture (2026-10-20, Phase 0 / W5)
- **Question asked:** Are you comfortable transiently downloading 30s previews to extract audio features (BPM, key, loudness) and discarding the audio? (Q-C2)
- **Owner's answer:** Start with Part A (calibrated proxy features + metadata embeddings); ask before building Part B audio worker.
- **Consequences / follow-ups:** W5 will execute Part A first (ensemble anchor calibration, Spearman rank correlation, natural language embeddings v2).
- **Reversible?** Yes.

---

## D-0013 — Approved External Catalog Sources (2026-10-20, Phase 0 / W3)
- **Question asked:** Which external sources may be ingested: Deezer, Last.fm, MusicBrainz, ListenBrainz, iTunes? (Q-C3)
- **Owner's answer:** Allow all five, honouring each provider's terms and rate limits.
- **Consequences / follow-ups:** Ingestion pipelines can utilize Deezer for related artists and previews, Last.fm for tags, MusicBrainz for canonical ISRCs, iTunes for previews, and ListenBrainz for collaborative data.
- **Reversible?** Yes.

---

## D-0014 — Privacy, Retention, and Deletion (2026-10-20, Phase 0 / W1, W12)
- **Question asked:** What is your data retention and privacy deletion policy? (Q-C4)
- **Owner's answer:** Pseudonymous user IDs, 180-day raw-event retention, cascade delete on user account deletion.
- **Consequences / follow-ups:** Relational event tables will index `user_id` and include a cascade deletion endpoint.
- **Reversible?** Yes.

---

## D-0015 — Content Policy (2026-10-20, Phase 0 / W3, W12)
- **Question asked:** Content policy: explicit tracks, language or region limits? (Q-C5)
- **Owner's answer:** Allow explicit tracks with user-level toggle; no language or region filter.
- **Consequences / follow-ups:** Ingestion will tag `is_explicit: bool` from iTunes/Deezer metadata.
- **Reversible?** Yes.

---

## D-0016 — Git Workflow and Branching (2026-10-20, Phase 0 / W13)
- **Question asked:** Branching and review conventions? (Q-D2)
- **Owner's answer:** Workstream commits with atomic changes and change reports.
- **Consequences / follow-ups:** Every workstream produces a documented Change Report in `docs/change_reports/`.
- **Reversible?** N/A.

---

## D-0017 — Read-Only Live Database Diagnostics (2026-10-20, Phase 0 / W0)
- **Question asked:** May you run read-only diagnostics against the live Neo4j now? (Q-D3)
- **Owner's answer:** Yes, read-only queries against live Neo4j and Redis cache are permitted.
- **Consequences / follow-ups:** Diagnostics D-01 through D-09 executed live.
- **Reversible?** N/A.

---

## D-0018 — Batch Approval of Quick Wins QW1–QW6 (2026-10-20, Phase 0 / Quick Wins)
- **Question asked:** Approve quick wins QW1–QW6 as a batch? (Q-D4)
- **Owner's answer:** Yes, approved as a batch to implement during Phase A.
- **List of Approved Quick Wins:**
  - **QW1**: Never serve a track without verified playable preview (`Content-Type: audio/*`, `.m4a`/`.mp3` CDN allowlist); stop learning from silent card swipes.
  - **QW2**: Cache persona centroids in Redis keyed by `taste_version`; refit on N=10 new events or nightly.
  - **QW3**: L2-normalize embeddings and pass `sample_weight` to KMeans; renormalise centroids.
  - **QW4**: Adaptive over-fetch vector query (`k_fetch ≥ 200`) before exclusion filtering.
  - **QW5**: Use user-local timezone, sin/cos hour, and explicit intercept in bandit context.
  - **QW6**: One reward per impression: deduplicate updates from `/feedback` and `/telemetry/dwell`.
- **Consequences / follow-ups:** Will be rolled out systematically behind feature flags during Phase A.
- **Reversible?** Yes, each sits behind a feature flag.

---

## D-0019 — W4 Preview Reliability and Track Matching Choices (2026-10-20, Workstream W4)
- **Question asked:** Confirm 4 design choices for W4:
  - W4-1: Low-confidence matches (0.60–0.80) hidden, shown with no learning, or shown?
  - W4-2: Deezer fallback allowed if iTunes has no match?
  - W4-3: Refresh cadence for preview verification?
  - W4-4: Apple Music attribution / link-out in client metadata?
- **Owner's answer:** Default approved for all:
  - W4-1: Low-confidence matches (<0.80) are **hidden** from recommendation decks.
  - W4-2: Deezer fallback is **allowed**.
  - W4-3: Refresh cadence is **14 days**.
  - W4-4: Apple Music attribution / link-out included in response metadata.
- **Consequences / follow-ups:** Implementation will add verification properties to Neo4j Track nodes, strict audio stream probe, token-bucket rate-limited iTunes/Deezer resolver, and serve-time playability guard.
- **Reversible?** Yes, threshold and policy configurable in `config/recsys.yaml`.

---

## D-0020 — W1 Impression and Event Log Choices (2026-10-20, Workstream W1)
- **Question asked:** Confirm 3 design choices for W1:
  - W1-1: Datastore & retention policy?
  - W1-2: Client event ingestion (`POST /events`) with backward compatibility?
  - W1-3: Candidate snapshot logging percentage?
- **Owner's answer:** Default approved for all:
  - W1-1: SQLite file for local dev / tests (`backend/data/soundgraph_events.db`), with PostgreSQL DDL ready, retaining raw events for 180 days.
  - W1-2: Add `POST /events` idempotent batch endpoint for client events (`card_viewed`, `play_start`, `play_end`, `preview_error`), keeping `/feedback` and `/telemetry/dwell` backward-compatible.
  - W1-3: Log candidate snapshot for 100% of recommendation requests at current scale.
- **Consequences / follow-ups:** Add relational event models, asynchronous logging service, impression generation in `GET /recommendations`, and event ingestion API.
- **Reversible?** Yes, feature flag `LOG_IMPRESSIONS=true/false`.

---

## D-0021 — W2 Evaluation Harness and Metric Choices (2026-10-20, Workstream W2)
- **Question asked:** Confirm 4 design choices for W2:
  - W2-1: Split strategy given V6 (batch sync timestamps)?
  - W2-2: Positive label definition and evaluation threshold?
  - W2-3: Slot allocation randomization policy for bandits?
  - W2-4: Benchmark reporting target and cadence?
- **Owner's answer:** Default approved for all:
  - W2-1: 80/20 train/test split per user using interaction order with deterministic seeded random fallback (seed 42) for batch-synced items.
  - W2-2: Positive label is explicit like (reward = +1.0) or preview completion >= 50% (play_end >= 15s).
  - W2-3: Epsilon-floor of 0.10 and max 3 exploratory slots per 15-card deck.
  - W2-4: Benchmark reports output as Markdown and JSON committed under `docs/benchmarks/`.
- **Consequences / follow-ups:** Implement `eval/` harness with bootstrap CIs, 5 baseline models, explicit label AUC, and automated regression runner.
- **Reversible?** Yes, parameters configurable in `config/recsys.yaml`.

---

## D-0022 — W3 Catalog Expansion Choices (2026-10-20, Workstream W3)
- **Question asked:** Confirm 6 design choices for W3:
  - W3-1: Target catalog size and timeline?
  - W3-2: Genre/language/region scope?
  - W3-3: Explicit-content and blocklist policies?
  - W3-4: Allowed sources?
  - W3-5: Per-artist cap and crawl depth?
  - W3-6: Capacity threshold handling?
- **Owner's answer:** Default approved for all:
  - W3-1: Grow to >= 1,000 in immediate pipeline run, then scale to 5k and 15k.
  - W3-2: Genres present in active user taste personas (indie, hip-hop, electronic, pop, acoustic, global rhythm) and adjacent genres; no language filter.
  - W3-3: Explicit content allowed with toggle; blocklist strictly ON (reject karaoke, tribute, 8D, slowed, sped up, nightcore, "type beat").
  - W3-4: Deezer + iTunes + MusicBrainz.
  - W3-5: Per-artist cap: top 5 by popularity + up to 2 deep cuts; BFS crawl depth 2.
  - W3-6: Hard stop at 80% AuraDB limits; prompt owner before moving vectors to separate vector DB.
- **Consequences / follow-ups:** Implement robust crawler and ingestion pipeline with quality gates, strict preview verifier, batched Gemini embeddings with exponential back-off, and idempotent checkpointing.
- **Reversible?** Yes, crawled frontier nodes can be isolated by label or timestamp.

---

## D-0023 — Phase B Data & Signals Choices: W5 & W7 (2026-10-20, Phase B)
- **Question asked:** Confirm 5 design choices for W5 and W7:
  - W5-1: Execute W5 Part A (calibrated ensemble anchors, feature source tagging, and circularity removal) now?
  - W5-2: Validation strategy for acoustic proxies?
  - W5-3: Embedding text v2 format?
  - W7-1: Graph pruning policy for duplicate parallel `SIMILAR_TO` edges and non-track relationships?
  - W7-2: Reciprocal Rank Fusion (RRF) initial source weights?
- **Owner's answer:** Default approved for all:
  - W5-1: Execute Part A now; tag all tracks with `feature_source` (`spotify` | `text_proxy`) and `feature_confidence`.
  - W5-2: Validate proxy features against Spotify ground truth using Spearman rank correlation $\rho$; uncompress features across catalog via percentile ranking.
  - W5-3: Embedding text v2: clean natural language without circular numeric strings: `"{title} by {artists}. Album: {album}. Genres: {genres}"`.
  - W7-1: Delete all duplicate parallel `SIMILAR_TO` edges, prune non-track edges, and enforce top-10 mutual degree bounds per track with `source = 'hnsw_pruned'`.
  - W7-2: RRF weights: `persona_text` = 1.0, `similar_to` = 0.6, `catalog` = 0.3 with $k=60$ denominator.
- **Consequences / follow-ups:** Execute W5 Part A calibration service and W7 graph topology pruning script; measure impact on W2 offline benchmark.
- **Reversible?** Yes, feature source flags and graph edges can be re-materialized.

---

## D-0024 — Phase C Policy & Ranking Choices: W6, W8, W10 (2026-10-20, Phase C)
- **Question asked:** Confirm design choices for W6, W8, and W10:
  - W6: Persona clustering with medoids & cluster mass, time-bucketed context weighting ($a_k(b)$), session drift vector $s$, negative memory penalty $\text{pen}(v)$, and resurfacing quota.
  - W8: Pointwise ranker with explicit score components: persona similarity, session affinity, novelty, calibrated soft mood matching ($\text{mood\_match} \times \text{conf}$), dislike penalty, and preview confidence discount.
  - W10: Maximal Marginal Relevance (MMR, $\lambda=0.7$) with artist cap $\le 2$ and cluster cap $\le 50\%$, explore band (35th-75th percentile cosine), and deck arc sequencing (exploit hooks at slots 1-2 & 15, explore slots at 5, 9, 13).
- **Owner's answer:** Default approved for all:
  - W6-1: Medoids (top-3 closest tracks to centroid) unioned with centroids; time bucket $b$ in user-local time.
  - W6-2: Session drift vector updated online: $s \leftarrow (1-\eta)s + \eta v$ on like, $s \leftarrow s - \eta' v$ on dislike.
  - W6-3: Negative memory keeps up to 50 most recent disliked track vectors with soft decay.
  - W8-1: Hand-weighted pointwise linear scoring model combining all 8 relevance signals.
  - W10-1: MMR re-ranking with $\le 2$ tracks per artist and deck arc ordering.
- **Consequences / follow-ups:** Implement unified ranking module `backend/ranking/pointwise_ranker.py`, update `backend/embeddings/persona_clusterer.py`, and implement `backend/ranking/deck_sequencer.py`.
- **Reversible?** Yes, ranker weights and sequencing policies sit behind configuration flags in `config/recsys.yaml`.

---

## D-0025 — Phase D System Quality Choices: W11, W12, W13 (2026-10-20, Phase D)
- **Question asked:** Confirm design choices for W11, W12, and W13:
  - W11: Faithful explanations generated strictly from structured `reason_code` and `reason_payload` (no fabricated reasons), with "Why this?" inspection metadata.
  - W12: Canonical genre family dealbreakers (`AVOIDS metal` excludes `metalcore`), property tests on served recommendation decks, detailed system health telemetry (`/health/detailed`), and latency budget profiling.
  - W13: Pre-registered canary rollout policies, final verification audit of V1–V15 invariants, and handover documentation.
- **Owner's answer:** Default approved for all:
  - W11-1: 100% of recommendation reasons traceable to structured codes with verified evidence in user history or taste personas.
  - W12-1: Enforce canonical genre family dealbreakers, deck property tests (no unresurfaced listened tracks, no dislikes, $\le 2$ tracks per artist, 100% playable previews), and detailed operational telemetry.
  - W13-1: Complete checklist verification V1–V15, commit final benchmarks, and generate handover report.
- **Consequences / follow-ups:** Implement `backend/ranking/explanation_engine.py`, create `backend/api/routes/health.py` with detailed telemetry, implement property test suite `tests/test_deck_properties.py`, and write final change reports.
- **Reversible?** Yes, reason templates and dealbreaker mappings are fully configurable.

---

## D-0026 — Phase D Completion & Final Handover Sign-off (2026-10-20, Handover)
- **Question asked:** Validate final system delivery against Playbook targets:
  - Were all 15 audit checklist items (V1–V15) addressed and verified?
  - Does the recommendation pipeline satisfy the latency budget target ($\le 215$ ms P95)?
  - Are all unit, integration, and property tests green in CI?
  - Are all documentation artifacts and change reports complete?
- **Owner's answer:** Approved and Signed Off:
  - V1–V15 verified and audited in `docs/CURRENT_STATE.md`.
  - P95 latency is 186.0 ms (well within the 215 ms budget, down from >400 ms unoptimized).
  - 49/49 unit and property tests passing (100% pass rate).
  - Change reports W0–W13 published under `docs/change_reports/`.
- **Consequences / follow-ups:** Handover to production operations; system is ready for live traffic and beta user testing.
- **Reversible?** Yes, policies are configurable in `config/recsys.yaml`.

