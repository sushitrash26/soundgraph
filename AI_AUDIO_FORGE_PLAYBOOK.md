# SoundGraph AI Audio Forge & Personalized Stem Remix Engine
## Production Architecture, Zero-Cost Deployment, and Agent Implementation Playbook

**Target SLA:** 100% Free Tier (CPU-Optimized + Gemini Free API Quota, $0 Cloud Cost)  
**Target Capabilities:** Dynamic Non-Hardcoded Instrument Disentanglement, Gemini 2.0 Multimodal Joint Audio-Text Latent Space, Neo4j Taste Graph Centroid Steering, DDSP/DSP Timbre Transformation, and Multi-Stem FFmpeg Master Export.

---

## 🚨 PHASE 0: MANDATORY DIRECTIVES FOR THE IMPLEMENTING AGENT

**DO NOT DEVIATE FROM THESE ARCHITECTURAL CONSTRAINTS:**
1. **ZERO GPU DEPENDENCY:** The deployment MUST run on standard CPU instances (Google Cloud Run CPU, local dev machines). Never write code that assumes CUDA/NVIDIA hardware is present without a CPU fallback.
2. **ZERO COST GUARANTEE:** All generative tasks must rely either on:
   - Google Gemini 1.5 Flash (Free Tier: 15 RPM, 1M TPM).
   - Google `gemini-embedding-2` (Free multimodal audio/text embeddings in the same 768/1536-D space).
   - Fast deterministic DSP algorithms (`librosa`, `scipy.signal`, `pedalboard`, FFmpeg).
   - CPU-friendly DDSP (Differentiable Digital Signal Processing) contour mapping.
3. **NEO4J AS THE UNIFIED MULTIMODAL HUB:** Raw audio stems must be embedded and projected directly into Neo4j as vector-indexed `(:Stem)` nodes connected via `[:PART_OF]` to `(:Track)` and `[:RESONATES_WITH]` to `(:User)`.
4. **ASYNC JOB ARCHITECTURE:** Audio separation and transformation are CPU-bound operations taking between 15 seconds to 3 minutes. Never block HTTP worker threads. Every heavy endpoint must return an asynchronous `job_id` with WebSocket / polling status endpoints.
5. **BLEED ELIMINATION:** Raw stem outputs from U-Net/demucs models have inter-instrument acoustic bleed. All stems MUST pass through an automated **adaptive spectral noise gate** (`-45 dBFS` floor with soft knee) before downstream indexing or playback.

---

## 1. High-Level Architecture & End-to-End Flow

```
                      ┌──────────────────────────────────────────────┐
                      │ User Uploads Audio (.mp3 / .wav, max 25MB)   │
                      └──────────────────────┬───────────────────────┘
                                             │
                      ┌──────────────────────▼───────────────────────┐
                      │  PHASE 1: Gemini Audio Understanding         │
                      │  (gemini-1.5-flash Audio Analysis)           │
                      │  - Identifies BPM, Key, Time Sig, Mood       │
                      │  - Dynamic Non-Hardcoded Stem Manifest JSON  │
                      └──────────────────────┬───────────────────────┘
                                             │
                      ┌──────────────────────▼───────────────────────┐
                      │  PHASE 2: CPU Stem Separation & De-Bleeding   │
                      │  - Demucs CPU (htdemucs / mdx_extra)         │
                      │  - Spectral Mask Resynthesis                 │
                      │  - Adaptive -45dB Spectral Noise Gate        │
                      └──────────────────────┬───────────────────────┘
                                             │
             ┌───────────────────────────────┴───────────────────────────────┐
             ▼                                                               ▼
┌─────────────────────────────────────────────┐ ┌─────────────────────────────────────────────┐
│ PHASE 3: Multimodal Latent Space & Graph    │ │ PHASE 4: Stem Transformation Engine         │
│ - gemini-embedding-2 (Audio -> 768/1536-D)  │ │ - Mode A: "Make It Match My Taste"        │
│ - Neo4j (:Stem) node vector creation        │ │   (Neo4j Taste Graph Centroid -> DSP)       │
│ - Shared geometry for Cross-Modal Search    │ │ - Mode B: Free-Form Text Prompt Editing    │
│   (e.g., text "warm indie bass" matches     │ │   (Gemini DSP Parameter Synthesis + DDSP    │
│   bass stem directly via Cosine Similarity) │ │    Timbre/Harmonic Envelope Transfer)       │
└─────────────────────────────────────────────┘ └──────────────────────┬──────────────────────┘
                                                                       │
                                        ┌──────────────────────────────▼──────────────────────┐
                                        │ PHASE 5: Master Multi-Track Remix & Export          │
                                        │ - Multi-stem volume, pan, mute, solo mixer          │
                                        │ - FFmpeg EBU R128 Loudness Normalization (-14 LUFS) │
                                        │ - Master MP3/WAV download & Neo4j Remix logging     │
                                        └─────────────────────────────────────────────────────┘
```

---

## 2. Directory & Component File Structure

All code for this feature must reside within these exact modular paths:

```
backend/
├── api/
│   └── routes/
│       └── audio_forge.py           # FastAPI endpoints for upload, separate, transform, remix
├── models/
│   └── audio_forge.py               # Pydantic schemas (Manifest, JobStatus, RemixRequest)
├── services/
│   └── audio_forge/
│       ├── __init__.py
│       ├── audio_analyzer.py        # Gemini 1.5 Flash Audio Fingerprinting & Manifest
│       ├── stem_separator.py        # Demucs CPU execution + Noise Gating
│       ├── multimodal_embedder.py   # gemini-embedding-2 audio/text unified embedding
│       ├── taste_styler.py          # Neo4j User Taste Centroid & DSP rule translation
│       ├── stem_transformer.py      # DSP effects engine + DDSP timbre modification
│       └── remix_mixer.py           # FFmpeg multi-stem recombination & normalization
tests/
└── test_audio_forge.py              # Full unit & mock integration test suite
```

---

## 3. Detailed Phase Specifications

### Phase 1: Gemini Audio Understanding & Dynamic Stem Manifest

#### Problem
Traditional splitters hardcode outputs into 4 generic bins: `[vocals, drums, bass, other]`. In modern indie, electronic, ambient, or hip-hop tracks, "other" contains synthesizer leads, arpeggiators, acoustic guitars, brass sections, and textures that users actually want to isolate and remix.

#### Implementation Contract (`backend/services/audio_forge/audio_analyzer.py`)
1. Ingest audio file (`.mp3` or `.wav`). If duration > 180s, analyze the representative high-energy 90s window (detected via RMS energy).
2. Transmit raw audio bytes directly to `gemini-1.5-flash` using `contents=[types.Part.from_bytes(data=bytes, mime_type="audio/mp3")]`.
3. Enforce strict JSON schema output matching `AudioStemManifest`:

```json
{
  "song_title": "Detected or Inferred Title",
  "bpm": 124,
  "musical_key": "F# minor",
  "energy_score": 0.78,
  "valence_score": 0.42,
  "acousticness_score": 0.15,
  "genre_classification": ["synthwave", "indie electronic"],
  "emotional_profile": "nostalgic, driving, nocturnal melancholia",
  "detected_instruments": [
    {
      "stem_id": "stem_vocal",
      "instrument": "vocals",
      "role": "lead_vocal",
      "demucs_source": "vocals",
      "description": "reverbed tenor vocal with airy top end",
      "frequency_focus": "300Hz-4500Hz"
    },
    {
      "stem_id": "stem_drums",
      "instrument": "drums",
      "role": "rhythm_section",
      "demucs_source": "drums",
      "description": "punchy 808 kick, crisp gated snare, 16th-note hi-hats",
      "frequency_focus": "40Hz-12000Hz"
    },
    {
      "stem_id": "stem_bass",
      "instrument": "bass",
      "role": "bassline",
      "demucs_source": "bass",
      "description": "analog sawtooth synth bass with resonant filter sweep",
      "frequency_focus": "40Hz-250Hz"
    },
    {
      "stem_id": "stem_lead_synth",
      "instrument": "synthesizer",
      "role": "melody_lead",
      "demucs_source": "other",
      "description": "detuned retro synth lead with chorus and stereo spread",
      "frequency_focus": "500Hz-6000Hz"
    },
    {
      "stem_id": "stem_pad",
      "instrument": "ambient_pad",
      "role": "harmonic_bed",
      "demucs_source": "other",
      "description": "lush analog string pad filling background stereo field",
      "frequency_focus": "200Hz-3500Hz"
    }
  ]
}
```

---

### Phase 2: CPU Stem Separation & Adaptive Spectral Noise Gating

#### Implementation Contract (`backend/services/audio_forge/stem_separator.py`)
1. **Model Selection for CPU:**
   - Default to Demucs `htdemucs` or `mdx_extra` with `--device cpu` and `-n htdemucs`.
   - Provide a fast-mode fallback using Librosa Harmonic-Percussive Source Separation (HPSS) + multi-band spectral masking if Demucs is not installed in the local environment, ensuring the API never crashes.
2. **Eliminating Bleed via Adaptive Spectral Noise Gate:**
   - Residual bleed from kick drums into the guitar or vocal stem ruins soloing and remixing.
   - Run each isolated stem through an RMS energy tracking gate:
     $$\text{threshold\_amp} = 10^{\frac{-45}{20}} \approx 0.0056$$
   - Apply a Hann-window smoothed attack (10ms) and release (50ms) envelope to prevent audible clicks when the gate opens and closes:
     ```python
     def apply_spectral_noise_gate(audio_arr: np.ndarray, sr: int, threshold_db: float = -45.0) -> np.ndarray:
         threshold = 10.0 ** (threshold_db / 20.0)
         frame_length = int(sr * 0.02)  # 20ms frames
         hop_length = int(sr * 0.005)   # 5ms hop
         rms = librosa.feature.rms(y=audio_arr, frame_length=frame_length, hop_length=hop_length)[0]
         # Interpolate RMS back to sample length
         rms_interp = np.interp(np.arange(len(audio_arr)), np.arange(len(rms)) * hop_length, rms)
         # Smooth mask with sigmoid transition around threshold
         gain = 1.0 / (1.0 + np.exp(-12.0 * (rms_interp - threshold) / threshold))
         return audio_arr * gain
     ```
3. Export sanitized individual stems as 44.1kHz 16-bit mono or stereo WAV files saved in `backend/data/stems/{job_id}/`.

---

### Phase 3: Multimodal Joint Latent Space (`gemini-embedding-2`) & Neo4j Integration

#### Unified Latent Space Theorem
`gemini-embedding-2` projects both text strings and raw audio waveforms into the same identical 768-D or 1536-D geometric manifold.
- A user's text query: `"crunchy overdriven electric guitar with tape delay"` produces vector $V_{\text{text}} \in \mathbb{R}^{768}$.
- The separated guitar stem audio bytes produce vector $V_{\text{audio}} \in \mathbb{R}^{768}$.
- Cross-modal affinity is strictly calculated via dot product / cosine similarity:
  $$\text{sim}(V_{\text{text}}, V_{\text{audio}}) = \frac{V_{\text{text}} \cdot V_{\text{audio}}}{\|V_{\text{text}}\| \|V_{\text{audio}}\|}$$

#### Neo4j Graph Schema Extension
Add the following node and relationship topology:

```cypher
// 1. Stem Node Definition
(:Stem {
    id: "stem_abc123_guitar",
    job_id: "job_abc123",
    label: "electric_guitar_lead",
    instrument: "guitar",
    demucs_source: "other",
    file_path: "/stems/job_abc123/guitar.wav",
    duration_sec: 142.5,
    rms_energy: 0.18,
    embedding: [0.0142, -0.0521, ..., 0.0911] // 768-dim float array
})

// 2. Relationships
(:Stem)-[:PART_OF]->(:Track {id: $track_id})
(:Stem)-[:EXTRACTED_BY]->(:User {id: $user_id})
(:Stem)-[:TRANSFORMED_INTO]->(:Stem) // lineage tracking for remixes
```

Create the vector index in Neo4j:
```cypher
CREATE VECTOR INDEX stem_embeddings IF NOT EXISTS
FOR (s:Stem) ON (s.embedding)
OPTIONS {indexConfig: {
  `vector.dimensions`: 768,
  `vector.similarity_function`: 'cosine'
}}
```

---

### Phase 4: Taste Centroid Derivation & Zero-Cost Stem Transformation

#### Mode A: "Make It Match My Taste" (Graph RAG -> DSP Parameter Synthesis)
1. **Taste Centroid Extraction:**
   Query Neo4j for the target user's acoustic DNA:
   ```cypher
   MATCH (u:User {id: $user_id})-[r:LISTENED_TO]->(t:Track)
   RETURN
       avg(coalesce(t.energy, 0.5)) AS user_energy,
       avg(coalesce(t.valence, 0.5)) AS user_valence,
       avg(coalesce(t.acousticness, 0.5)) AS user_acousticness,
       avg(coalesce(t.danceability, 0.5)) AS user_danceability
   ```
2. **Acoustic Differential Vector Calculation:**
   $$\Delta \text{Energy} = \text{user\_energy} - \text{stem\_energy}$$
   $$\Delta \text{Acousticness} = \text{user\_acousticness} - \text{stem\_acousticness}$$
   $$\Delta \text{Valence} = \text{user\_valence} - \text{stem\_valence}$$

3. **Deterministic DSP Translation Matrix (Runs in < 500ms on CPU):**
   - If $\Delta \text{Acousticness} > +0.25$: Apply analog warm filter (Butterworth 2nd-order low-pass at 4200Hz), subtle tube saturation (tanh soft clipping), and convolution plate reverb (room size = 0.65).
   - If $\Delta \text{Acousticness} < -0.25$: Apply high-shelf exciter boost (+3.5dB at 8kHz) and dynamic sidechain compression.
   - If $\Delta \text{Energy} > +0.20$: Increase RMS gain (+2.5dB), add 2nd harmonic overdrive, and apply transient shaping (sharpen attack by 25%).
   - If $\Delta \text{Valence} < -0.20$: Pitch shift stem down by 1 semitone, add tape-flutter modulation (LFO rate = 0.8Hz, depth = 3 cents).

#### Mode B: Prompt-Guided Transformation (e.g., "Acoustic to Electric Guitar")
When the user submits a prompt:
1. Gemini 1.5 Flash translates the musical instruction into exact DSP parameters and parametric EQ curves:
   ```json
   {
     "pitch_shift_semitones": 0,
     "distortion_drive_db": 12.0,
     "cabinet_filter_cutoff_hz": 3200,
     "reverb_wet": 0.35,
     "delay_time_ms": 240,
     "delay_feedback": 0.4,
     "eq_bands": [
       {"freq": 250, "gain_db": -3.0, "q": 1.0},
       {"freq": 2800, "gain_db": 4.5, "q": 2.0}
     ]
   }
   ```
2. The DSP engine processes the raw audio tensor in-memory via `scipy.signal` and `librosa`, returning the transformed WAV in under 3 seconds on any standard CPU.

---

### Phase 5: Recombination, Multi-Track Mixer & Master Export

#### Implementation Contract (`backend/services/audio_forge/remix_mixer.py`)
1. Ingest stem paths with per-track user adjustments:
   ```json
   {
     "stems": [
       {"stem_id": "stem_vocal", "volume_db": 0.0, "pan": 0.0, "is_muted": false},
       {"stem_id": "stem_drums", "volume_db": -1.5, "pan": 0.0, "is_muted": false},
       {"stem_id": "stem_bass", "volume_db": +1.0, "pan": 0.0, "is_muted": false},
       {"stem_id": "stem_lead_synth", "volume_db": -2.0, "pan": -0.3, "is_muted": false},
       {"stem_id": "stem_pad", "volume_db": -4.0, "pan": 0.3, "is_muted": false}
     ],
     "master_gain_db": 0.0,
     "output_format": "mp3"
   }
   ```
2. Construct dynamic FFmpeg filter graph:
   ```bash
   ffmpeg -y \
     -i stem_vocal.wav -i stem_drums.wav -i stem_bass.wav -i stem_lead.wav \
     -filter_complex \
       "[0:a]volume=0.0dB,pan=stereo|c0=c0|c1=c1[a0]; \
        [1:a]volume=-1.5dB,pan=stereo|c0=c0|c1=c1[a1]; \
        [2:a]volume=1.0dB,pan=stereo|c0=c0|c1=c1[a2]; \
        [3:a]volume=-2.0dB,pan=stereo|c0=0.85*c0|c1=0.55*c1[a3]; \
        [a0][a1][a2][a3]amix=inputs=4:normalize=0,loudnorm=I=-14:TP=-1.0:LRA=11[out]" \
     -map "[out]" -b:a 320k remix_master.mp3
   ```
3. Deliver broadcast-ready master normalized strictly to `-14 LUFS` EBU R128 with `-1.0 dBFS` true peak limit.

---

## 4. Complete API Specifications (`backend/api/routes/audio_forge.py`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/audio/analyze` | Multipart upload audio -> runs Gemini analysis -> returns Stem Manifest |
| `POST` | `/audio/separate` | Triggers asynchronous Demucs/HPSS separation -> returns `job_id` |
| `GET` | `/audio/job/{job_id}/status` | Polls separation/transformation progress & returns stem list |
| `POST` | `/audio/stem/{stem_id}/embed` | Computes `gemini-embedding-2` vector & writes node to Neo4j |
| `POST` | `/audio/stem/{stem_id}/transform` | Applies taste-based or prompt-based DSP modification |
| `POST` | `/audio/remix/export` | Combines stems with volumes/pans via FFmpeg into master MP3 |
| `GET` | `/audio/stem/download/{stem_id}` | Streams audio bytes for preview in mobile player |
| `GET` | `/audio/search/stems` | Cross-modal text-to-audio search over Neo4j stem index |

---

## 5. Verification Protocol & Test Suite

Any agent implementing this specification MUST run the following automated test suite before reporting completion:

### Test Case 1: Synthetic Audio Signal Generation
- Generate a 10-second stereo WAV containing a 440Hz sine wave (representing lead melody) mixed with a 60Hz square wave (representing bass) and white noise bursts (representing drums).
- Verify file headers and 44.1kHz sample rate compatibility.

### Test Case 2: Adaptive Noise Gate Verification
- Inject `-50 dBFS` low-level white noise into silent intervals.
- Assert that the processed signal attenuates the silent regions to `< -75 dBFS` without clipping the `440Hz` active signal.

### Test Case 3: Gemini Multimodal Embedding Sanity Check
- Verify that passing audio bytes to the embedder returns a 768-D non-null vector with `L2 norm == 1.0` (unit normalized).

### Test Case 4: Neo4j Taste Centroid Query Resilience
- Execute the taste centroid query with an unauthenticated guest user and assert that safe fallback defaults (`energy=0.5`, `acousticness=0.5`) are returned without unhandled exceptions.

### Test Case 5: Master Recombination & Loudness Test
- Combine 3 synthetic stems via `remix_mixer.py`.
- Verify the resulting MP3 is created, has non-zero size, and conforms to `-14 LUFS ± 1.5 dB` integrated loudness.

---

## 6. Execution Command Quick Reference

```bash
# 1. Run the Audio Forge test suite
python3 -m pytest tests/test_audio_forge.py -v

# 2. Start the FastAPI server locally
./venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload

# 3. Test analyze endpoint with curl
curl -X POST "http://localhost:8001/audio/analyze" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@tests/fixtures/sample_mix.wav"
```
