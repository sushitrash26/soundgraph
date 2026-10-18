# Hexa-Sonic v2: Disentangled Multi-Stream Music Recognition & QBH Engine

**Target Accuracy:** 99.99% Human-Perceived Recall (Exact Playback, Pitch-Shifted/Sped-Up Edits, Off-Key Humming, Mumbled Lyrics, & Chimeric Mashups)  
**Target Query Latency:** `< 250ms` (End-to-End CPU/ONNX Pipeline)

---

## 🚨 PHASE 0: MANDATORY PRE-CODING PROTOCOL FOR THE AI AGENT (READ FIRST!)

**STOP! DO NOT WRITE OR MODIFY ANY APPLICATION CODE YET.**

Before writing a single line of implementation code, you (the Coding Agent) must follow this strict 2-step onboarding protocol with the user:

### Step 1: Silent Codebase Reconnaissance
Scan the user's current project workspace and identify:
1. Where audio capture/upload routes and existing Shazam / audio API integrations live.
2. How the current Graph RAG (Neo4j / Vector DB) and search engine are structured (existing node labels, relationships, vector indexes, and lyric search).
3. Whether local audio files or 30s preview streams are stored/accessible for catalog ingestion.
4. What hardware acceleration (CUDA, Apple MPS, or CPU-only) and backend framework (FastAPI, Flask, Node.js bridge, etc.) are currently configured.

### Step 2: Ask the User These Exact Alignment Questions
After scanning the repo, present a brief summary of what you found in the codebase and **ask the user the following questions**. Wait for their explicit confirmation before writing any code:

1. **Codebase Integration & Replacement Strategy:**
   - *"I found your existing audio recognition / Graph RAG logic at `[insert file paths found]`. Should I wrap your existing Shazam API as the fallback for Track 1 (Master Audio Match), or replace it entirely with the local Scale-Invariant Constellation Fingerprinter?"*
2. **Catalog Audio & Offline Stem/Melody Ingestion Scope:**
   - *"To achieve 99.99% humming/singing accuracy, we need pre-computed vocal & instrumental pitch contours ($\Delta P$ and IOI ratios) and IPA phonetic lyric indexes. Which initial song corpus should we ingest first (e.g., a custom test list of 50–500 tracks, Spotify/YouTube playlist URLs, or existing tracks in your DB), and how should we fetch the audio for offline ingestion?"*
3. **Graph RAG & Database Schema Migration:**
   - *"Your current database schema uses `[insert detected DB/schema]`. Are you okay with me adding the `(:Recording)-[:IS_VERSION_OF]->(:CanonicalWork)` hierarchy in Neo4j and a local FAISS + SQLite/LMDB store for millisecond melody/hash lookups?"*
4. **Chimeric Mashup UI/API Contract:**
   - *"When a user sings the lyrics of Song A (e.g., 'Starboy') over the melody/tempo of Song B (e.g., 'Snooze' or 'Runaway'), the backend will return `mode: 'CHIMERIC_MASHUP_DETECTED'` with both tracks and their matched timestamps. How would you like the frontend UI to render this dual match?"*
5. **Hardware & Model Weight Footprint:**
   - *"Running RMVPE (vocal pitch), Basic-Pitch, and Faster-Whisper locally via ONNX requires downloading ~350MB–1.2GB of model weights. Should I configure the pipeline for CPU-only (`onnxruntime` + `numba`) or enable GPU acceleration (`CUDA` / `CoreML`) on your machine?"*

**Once the user answers these questions, proceed to implement Phases 1 through 7 below in modular, testable stages.**

---

## 1. Strict Architectural Guardrails (DO NOT VIOLATE DURING CODING)

1. **NO Naive Score Averaging:** Never average or sum raw similarity scores across lyrics and melody when top candidates conflict. Use the **Z-Score Distinctiveness Margin Router** defined in Section 6.
2. **NO `3000Hz` Low-Pass Filter on Master Audio:** Keep full `8000Hz` Nyquist bandwidth (`16kHz` sample rate) for acoustic fingerprinting and ASR; only apply narrowband filtering (`80Hz–1200Hz`) on the isolated pitch-tracking bus.
3. **NO Global Mean Pitch Subtraction on Fixed Frames:** Humans pause to breathe and drift flat in key over time. You must segment continuous $F_0$ into discrete **Note-Onset Events** and compute **first-order adjacent semitone deltas ($\Delta p_i = p_i - p_{i-1}$)** and **Inter-Onset Interval Ratios ($r_i = \text{IOI}_i / \text{IOI}_{i-1}$)**.
4. **NO Polyphonic Soup Ingestion:** Never run pitch extraction directly on a full studio mix during catalog ingestion. Always split stems first (`vocals.wav` + `accompaniment.wav`) so vocal humming matches against clean vocal contours and instrumental riffs match against clean accompaniment contours.
5. **NO Pure-Python `fastdtw` in Loops:** Use **FAISS 128-D Coarse Retrieval** followed by **Numba `@njit(parallel=True)` Subsequence Dynamic Time Warping (S-DTW)** on the top $K=100$ candidates.

---

## 2. System Architecture & Dual-Bus Signal Routing

When a user records a $3\text{s}–15\text{s}$ audio clip, normalize it to `16kHz` mono `float32` PCM (`-20 dBFS` RMS target via dynamic range compression) and split it into two distinct acoustic buses:

```
                       ┌─────────────────────────────────────────────────────────┐
                       │         Raw User Audio (3s - 15s, 16kHz Mono PCM)       │
                       └────────────────────────────┬────────────────────────────┘
                                                    │
                         ┌──────────────────────────┴──────────────────────────┐
                         ▼                                                     ▼
        ┌─────────────────────────────────┐                   ┌─────────────────────────────────┐
        │   BUS 1: High-Bandwidth Bus     │                   │   BUS 2: Vocal/Harmonic Bus     │
        │   High-Pass > 120Hz (Up to 8kHz)│                   │   On-Device Vocal Isolation +   │
        │   Preserves Transients & Sibil. │                   │   Bandpass (80Hz - 1200Hz)      │
        └────────┬───────────────┬────────┘                   └────────┬───────────────┬────────┘
                 │               │                                     │               │
                 ▼               ▼                                     ▼               ▼
        ┌────────────────┐ ┌────────────────┐                 ┌────────────────┐ ┌────────────────┐
        │ STREAM A:      │ │ STREAM C:      │                 │ STREAM B:      │ │ STREAM D:      │
        │ Scale-Invariant│ │ Dual-Path ASR  │                 │ Event-Delta    │ │ Beat & Cadence │
        │ Constellation  │ │ + IPA Phonetic │                 │ Pitch Contour  │ │ IOI Ratio      │
        │ Fingerprinter  │ │ N-Gram Matcher │                 │ + Numba S-DTW  │ │ Matcher        │
        └────────┬───────┘ └────────┬───────┘                 └────────┬───────┘ └────────┬───────┘
                 │                  │                                  │                  │
                 └──────────────────┴─────────────────┬────────────────┴──────────────────┘
                                                      ▼
                                    ┌───────────────────────────────────┐
                                    │   Canonical Graph Deduplicator    │
                                    │   (Neo4j Recording -> Work Prior) │
                                    └─────────────────┬─────────────────┘
                                                      ▼
                                    ┌───────────────────────────────────┐
                                    │  Chimeric Z-Score Conflict Router │
                                    └───────────────────────────────────┘
```

---

## 3. Offline Catalog Ingestion Pipeline (Pre-Computation DAG)

Every song added to our catalog must be processed through this offline pipeline to populate **FAISS** (melody/rhythm vectors), **Typesense/SQLite-FTS5** (IPA phonetic n-grams), **LMDB/SQLite** (scale-invariant acoustic hashes), and **Neo4j** (Canonical Work hierarchy).

### Step 3.1: Canonical Work Graph Mapping (Neo4j)

Prevent remixes, covers, or lofi edits from beating the original song when scores are tied:

```cypher
MERGE (w:CanonicalWork {work_id: $work_id})
ON CREATE SET w.title = $canonical_title, w.iswc = $iswc

MERGE (r:Recording {track_id: $track_id})
SET r.title = $title,
    r.artist = $artist,
    r.is_original_master = $is_original_master, // boolean
    r.global_popularity_score = $popularity_score, // 0.0 to 1.0 (log-normalized play count)
    r.duration_sec = $duration

MERGE (r)-[:IS_VERSION_OF]->(w)
```

### Step 3.2: Stem Separation & Multi-Contour Extraction

1. **Stem Split:** Run `htdemucs` (or `Mel-Band-Roformer`) on the master track to output `vocals.wav` and `accompaniment.wav`.
2. **Vocal Contour Extraction:** Run **RMVPE** (`onnxruntime`) at `10ms` hop size on `vocals.wav` to extract fundamental frequency $F_0(t)$ and voicing confidence $v(t) \in [0, 1]$.
3. **Instrumental Hook Extraction:** Run `basic-pitch` (`onnxruntime`) on `accompaniment.wav` and extract the top-line predominant melodic contour (captures piano/guitar/synth hooks like *Runaway*).
4. **Windowing:** Slice both contours into overlapping **8-second windows** with a **1.5-second stride**. Store each window in FAISS + LMDB with `track_id`, `stem_type` (`vocal` | `instrumental`), and `start_timestamp_sec`.

---

## 4. Core Algorithms & Mathematical Specifications

### Stream A: Scale- & Pitch-Invariant Constellation Hashing (Speaker & TikTok Edit Match)

Standard Shazam hashes break if the speaker playback is sped up ($1.15\times$) or pitch-shifted ($\pm 2$ semitones). Implement **Triplet Ratio Hashing (Panako/Olaf method)** alongside any existing Shazam API fallback:

1. Compute STFT on **Bus 1** (`n_fft=2048`, `hop_length=512`, `sr=16000`).
2. Extract local 2D spectral peaks $(t_i, f_i)$ using a maximum filter neighborhood of `(15 frames, 15 bins)`.
3. Form triplets of anchor-target peaks $A(t_1, f_1), B(t_2, f_2), C(t_3, f_3)$ within a $2.0\text{s}$ lookahead zone.
4. Convert frequencies to logarithmic Constant-Q cents and pack a **32-bit Scale-Invariant Hash**:
   $$\Delta c_{12} = \text{round}\left(1200 \log_2\left(\frac{f_2}{f_1}\right) / 25\right), \quad \Delta c_{23} = \text{round}\left(1200 \log_2\left(\frac{f_3}{f_2}\right) / 25\right)$$
   $$R_t = \text{round}\left(\frac{t_3 - t_2}{t_2 - t_1} \cdot 16\right)$$
   $$\text{Hash} = (\Delta c_{12} \ll 20) \mid (\Delta c_{23} \ll 8) \mid (R_t \ \& \ \text{0xFF})$$
5. Run a sliding **3-second window** matcher. If any track accumulates $>15$ collinear time-offset matches, short-circuit and return a **99.9% Master Match**.

---

### Stream B: Key-Invariant, Drift-Immune, & Tempo-Invariant Melody Engine

This stream processes **Bus 2** and is 100% blind to lyrics.

#### 1. Continuous $F_0$ to Discrete Note-Event Segmentation
Given $F_0(t)$ in Hz and voicing confidence $v(t)$ from RMVPE:
1. Mask unvoiced frames where $v(t) < 0.45$ or $F_0(t) < 65\text{ Hz}$.
2. Convert voiced frames to continuous MIDI pitch:
   $$m(t) = 69 + 12 \log_2\left(\frac{F_0(t)}{440.0}\right)$$
3. Apply a 5-frame median filter to remove micro-glitches, then segment into discrete **Note Events** $E = [(p_1, t_1^{\text{on}}, d_1), \dots, (p_N, t_N^{\text{on}}, d_N)]$ where:
   * A new note onset $t_i^{\text{on}}$ is triggered when $\vert\text{MIDI}(t) - \text{MIDI}(t-1)\vert > 0.65$ semitones or after an unvoiced gap $> 80\text{ms}$, OR via vocal energy flux onset detection (for repeated same-pitch notes).
   * $p_i = \text{median}(m(t))$ across the duration of note $i$.
   * Discard transient blips where duration $d_i < 90\text{ms}$.

#### 2. Adjacent Interval Delta ($\Delta P$) & Inter-Onset Interval Ratio ($R_{\text{IOI}}$)
To achieve 100% invariance to **Musical Key**, **Gradual Singer Pitch Drift**, and **Tempo (BPM)**:
$$\Delta p_i = \text{clip}(p_{i} - p_{i-1}, -12.0, +12.0) \quad \text{for } i \in [2, N]$$
$$\text{IOI}_i = t_i^{\text{on}} - t_{i-1}^{\text{on}}, \quad r_i = \text{clip}\left(\log_2\left(\frac{\text{IOI}_i}{\text{IOI}_{i-1}}\right), -3.0, +3.0\right)$$

#### 3. Two-Stage Retrieval (FAISS Coarse $\rightarrow$ Numba S-DTW Fine)
* **Stage 1 (128-D Coarse Vector in FAISS):**
  Construct a 128-dimensional embedding per phrase by combining:
  * Normalized 2D joint histogram of $(\Delta p_i, r_i)$ ($16 \times 8 = 128$ bins, Gaussian-smoothed with $\sigma=0.7$ so off-key/off-beat notes spill smoothly into adjacent bins), **OR** a pre-trained 128-D Contrastive Conformer (ByteHum-style) embedding.
  * Query FAISS Index (`IndexHNSWFlat`, `efSearch=64`) to retrieve Top $K = 100$ candidate song windows in $< 5\text{ms}$.

* **Stage 2 (Numba C-Compiled Subsequence DTW):**
  Run exact Subsequence DTW over the $(\Delta p_i, r_i)$ sequence of the user query $Q$ (length $M$) against each of the Top 100 candidate sequences $C_k$ (length $L$).

```python
import numpy as np
from numba import njit, prange

@njit(fastmath=True)
def subsequence_dtw_cost(q_dp, q_ioi, c_dp, c_ioi, pitch_weight=0.75, rhythm_weight=0.25):
    """
    Computes Subsequence Dynamic Time Warping (S-DTW) between user query (M)
    and catalog segment (L). Allows query to start and end anywhere within C.
    """
    M = len(q_dp)
    L = len(c_dp)
    if M < 3 or L < M:
        return 999.0

    # Cost matrix initialized to infinity, except row 0 (free start anywhere in C)
    D = np.full((M + 1, L + 1), np.inf, dtype=np.float32)
    for j in range(L + 1):
        D[0, j] = 0.0

    for i in range(1, M + 1):
        for j in range(1, L + 1):
            # Huber-like robust distance on semitone delta + rhythm ratio
            diff_p = abs(q_dp[i - 1] - c_dp[j - 1])
            # Penalize octave errors lightly, semitone errors linearly
            if diff_p > 10.5 and diff_p < 13.5:
                diff_p = abs(diff_p - 12.0) + 0.5
            
            diff_r = abs(q_ioi[i - 1] - c_ioi[j - 1])
            cost = pitch_weight * diff_p + rhythm_weight * diff_r

            # Standard DTW transitions with insertion/deletion penalty
            d_match = D[i - 1, j - 1]
            d_ins = D[i - 1, j] + 0.6
            d_del = D[i, j - 1] + 0.6

            min_prev = d_match
            if d_ins < min_prev:
                min_prev = d_ins
            if d_del < min_prev:
                min_prev = d_del

            D[i, j] = cost + min_prev

    # Best alignment end-point in C, normalized by query length M
    min_final = np.min(D[M, 1:]) / float(M)
    return np.exp(-0.65 * min_final) # Maps 0 cost -> 1.0 similarity
```

---

### Stream C: Phonetic & Vowel-Skeleton Lyric Engine (The Mumble Fix)

This stream processes **Bus 1** (and isolated vocals) and is 100% blind to melody and tempo.

1. **Dual Phoneme + Lexical Extraction:**
   * Run `faster-whisper` (`small` or `large-v3-turbo` with `vad_filter=True`, `condition_on_previous_text=False` to prevent LLM loop hallucinations).
   * Convert output text to **IPA Phonemes** via `phonemizer` / `gruut`, AND extract a **Vowel-Nucleus + Consonant-Class Skeleton** (mapping all plosives `p,b,t,d,k,g` $\to$ `P`, nasals `m,n,ŋ` $\to$ `N`, fricatives `s,z,f,v,ʃ` $\to$ `F`, and preserving exact vowel phonemes).
2. **Humming vs. Singing Gating ($C_{\text{lexical}}$):**
   * Compute Phonetic Diversity Score $C_{\text{lexical}} \in [0, 1]$:
     * If $>70\%$ of detected phonemes are repetitive nasal/open hum syllables (`/m/`, `/n/`, `/lɑ/`, `/dɑ/`, `/nɑ/`) or Whisper `no_speech_prob > 0.65`, set $C_{\text{lexical}} = 0.0$ (Pure Humming Mode—Stream C is muted so it cannot hallucinate songs).
3. **Phonetic N-Gram Search:**
   * Query the inverted lyric index using both **3-gram IPA Phonemes** and **BM25 Fuzzy Keyword Search**.
   * Re-rank top 25 lyric hits using **Normalized Phonetic Levenshtein Similarity** ($S_{\text{lyric}} \in [0, 1]$).

---

### Stream D: Monotone Rhythm & Beatbox Engine

When a user taps a desk, beatboxes, or hums a rhythm on a single monotone pitch (where Pitch Entropy $H_p \approx 0$ and Lexical Clarity $C_{\text{lexical}} \approx 0$):
1. Extract percussive/syllabic onsets using `librosa.onset.onset_detect` with spectral flux.
2. Compute the sequence of normalized IOI ratios $r_i$ and Tempo Autocorrelation Tempogram.
3. Match against catalog vocal cadence & drum groove skeletons via 1D S-DTW.

---

## 5. Canonical Graph Deduplication & Prior Boosting

Before sending Stream B and Stream C candidates to the Arbiter, group all candidate `Recording` nodes by their parent `CanonicalWork` node in Neo4j:

$$S_{\text{adjusted}}(r) = S_{\text{raw}}(r) \cdot \left(1.0 + 0.08 \cdot \mathbb{I}_{\text{original\_master}}(r) + 0.05 \cdot r.\text{global\_popularity\_score}\right)$$

This guarantees that if a user sings *Starboy* slowly, the original Weeknd master beats an obscure acoustic cover or lofi remix that shares the same lyrics/melody.

---

## 6. The Chimeric Decision Arbiter (Z-Score Distinctiveness Router)

**CRITICAL:** Never use raw percentage cutoffs (like `> 45%`) alone, and never average Stream B and Stream C scores when they point to different songs.

### Step 6.1: Compute Within-Stream Distinctiveness Z-Scores

For Stream B (Melody candidates $M_1, M_2, \dots, M_{50}$ sorted descending) and Stream C (Lyric candidates $L_1, L_2, \dots, L_{25}$ sorted descending):

$$Z_M = \frac{S(M_1) - \mu_{M_{2..25}}}{\sigma_{M_{2..25}} + 10^{-4}}, \quad Z_L = \frac{S(L_1) - \mu_{L_{2..25}}}{\sigma_{L_{2..25}} + 10^{-4}}$$

### Step 6.2: Deterministic Routing Matrix

```python
def resolve_chimeric_arbiter(M_candidates, L_candidates, R_candidates, C_lexical, pitch_entropy):
    M1 = M_candidates[0] if M_candidates else None
    L1 = L_candidates[0] if (L_candidates and C_lexical > 0.25) else None

    Z_M = compute_z_score(M_candidates)
    Z_L = compute_z_score(L_candidates) if L1 else 0.0

    # CASE 1: UNANIMOUS AGREEMENT OR SYNERGISTIC BOOST (Same Canonical Work)
    # Even if user sang 50% off-key (moderate S_M) and mumbled 50% of words (moderate S_L),
    # if both streams independently rank Song X in their Top 3, joint probability is >99.99%!
    shared_works = find_intersection_in_top_k(M_candidates[:5], L_candidates[:5])
    if shared_works and C_lexical > 0.25:
        best_work = shared_works[0]
        joint_conf = min(0.999, 1.0 - (1.0 - best_work.S_M) * (1.0 - best_work.S_L))
        return {
            "mode": "UNANIMOUS_OR_SYNERGISTIC_MATCH",
            "confidence": joint_conf,
            "primary_match": best_work.canonical_recording,
            "explanation": "Matched both your vocal melody/tempo and lyrics."
        }

    # CASE 2: THE CHIMERIC MASHUP (e.g., Starboy Lyrics sung over Snooze or Runaway Melody)
    # Both streams have high distinctiveness (Z > 2.8) AND strong absolute alignment,
    # but point to completely different Canonical Works!
    if (L1 and M1) and (L1.work_id != M1.work_id) and (Z_L >= 2.8 and L1.score >= 0.68) and (Z_M >= 2.6 and M1.score >= 0.62):
        return {
            "mode": "CHIMERIC_MASHUP_DETECTED",
            "confidence": max(L1.score, M1.score),
            "lyric_match": {
                "track": L1.canonical_recording,
                "confidence": L1.score,
                "matched_timestamp_sec": L1.timestamp_sec,
                "badge": "Matched Your Lyrics"
            },
            "melody_match": {
                "track": M1.canonical_recording,
                "confidence": M1.score,
                "matched_timestamp_sec": M1.timestamp_sec,
                "badge": "Matched Your Melody & Tempo"
            },
            "explanation": f"You sang the lyrics to '{L1.title}' over the melody/beat of '{M1.title}'!"
        }

    # CASE 3: PURE HUMMING / WHISTLING (Lexical gate closed or low lyric score)
    if (C_lexical <= 0.25 or Z_L < 2.0) and M1 and (Z_M >= 2.4 or M1.score >= 0.65):
        return {
            "mode": "PURE_MELODIC_MATCH",
            "confidence": M1.score,
            "primary_match": M1.canonical_recording,
            "matched_timestamp_sec": M1.timestamp_sec,
            "explanation": "Identified from your hummed pitch contour and rhythm."
        }

    # CASE 4: MONOTONE SINGING / RAPPING (Low pitch entropy or poor singer, clear lyrics)
    if L1 and (Z_L >= 2.5 or L1.score >= 0.72):
        return {
            "mode": "PHONETIC_LYRIC_MATCH",
            "confidence": L1.score,
            "primary_match": L1.canonical_recording,
            "matched_timestamp_sec": L1.timestamp_sec,
            "explanation": "Identified from your sung lyrics and phonetic cadence."
        }

    # CASE 5: ZERO-HALLUCINATION DIAGNOSTIC FALLBACK
    return {
        "mode": "MULTI_CANDIDATE_FALLBACK",
        "confidence": max(M1.score if M1 else 0, L1.score if L1 else 0),
        "candidates": merge_and_deduplicate_top_3(M_candidates, L_candidates, R_candidates),
        "explanation": "Close matches found across melody and lyrics—tap to preview at the matched hook."
    }
```

---

## 7. Required Python Dependencies (`requirements.txt`)

```txt
numpy>=1.26.0
scipy>=1.12.0
librosa>=0.10.1
numba>=0.59.0
faiss-cpu>=1.8.0
onnxruntime>=1.17.0
faster-whisper>=1.0.1
phonemizer>=3.2.1
rapidfuzz>=3.6.1
neo4j>=5.18.0
demucs>=4.0.1
```

---

## 8. Automated Verification Test Suite (Must Pass Before Merging)

Your implementation is only complete when `pytest tests/test_hexa_sonic.py` passes these 5 benchmark assertions:

1. **`test_speaker_reverb_and_nightcore()`**: Play a catalog track at `1.12x` speed and `+2` semitones through room impulse response reverb $\rightarrow$ Stream A must resolve the exact track in `< 150ms`.
2. **`test_off_key_rubato_humming()`**: Synthesize a hum of *Runaway* shifted by `+5` semitones, with a `-2` semitone gradual flat drift, a `0.8s` mid-phrase breath pause, and `30%` tempo fluctuation $\rightarrow$ Stream B must rank *Runaway* #1 with $Z_M > 3.0$.
3. **`test_mumbled_50_percent_lyrics()`**: Input audio with 50% mumbled vowels of *Starboy* sung on a flat monotone pitch $\rightarrow$ Stream C phonetic skeleton must rank *Starboy* #1.
4. **`test_chimeric_mashup_starboy_snooze()`**: Input audio singing *Starboy* lyrics to the exact melody and BPM of *Snooze* (or *Runaway*) $\rightarrow$ Arbiter must return `mode == "CHIMERIC_MASHUP_DETECTED"` with `lyric_match == "Starboy"` and `melody_match == "Snooze"`.
5. **`test_canonical_deduplication()`**: Ensure the original studio release of a song beats a karaoke/acoustic cover in Neo4j when hummed.