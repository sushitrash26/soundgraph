# 🎵 SoundGraph

<div align="center">
  <img src="frontend/public/soundgraph_logo.jpg" alt="SoundGraph Logo" width="128" style="border-radius: 28px; box-shadow: 0 0 40px rgba(168, 85, 247, 0.4);" />

  ### Autonomous Multimodal Music Taste Knowledge Graph & Global Audio Recognition Engine
  **Graph-RAG Discovery · Hexa-Sonic v2 Disentangled Audio Engine · Neo4j GDS · LinUCB Bandits · Expo Native Mobile**

  [![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
  [![Hexa-Sonic v2](https://img.shields.io/badge/Engine-Hexa--Sonic_v2-8b5cf6?logo=waveform&logoColor=white)](https://github.com)
  [![Zero Paid APIs](https://img.shields.io/badge/Audio_APIs-Zero_Paid_Subscription-10b981?logo=checkmarx&logoColor=white)](https://github.com)
  [![Neo4j GDS](https://img.shields.io/badge/Neo4j-2026.09_GDS-008CC1?logo=neo4j&logoColor=white)](https://neo4j.com/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
  [![Docker Ready](https://img.shields.io/badge/Docker-Multi--Stage_Build-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
  [![React 18](https://img.shields.io/badge/React-18.3+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
  [![React Native Expo](https://img.shields.io/badge/Expo-SDK_54-000020?logo=expo&logoColor=white)](https://expo.dev/)
  [![Numba Accelerated](https://img.shields.io/badge/Numba-JIT_S--DTW-00A3E0?logo=python&logoColor=white)](https://numba.pydata.org/)
</div>

---

## 🌟 Executive Summary

**SoundGraph** is an enterprise-grade autonomous music intelligence, deck curation, and global acoustic recognition platform. It reconciles heterogeneous listening histories and telemetry across **Spotify** and **YouTube Music** into a topological knowledge graph powered by **Neo4j Graph Data Science (GDS)** and **Google Gemini 768-D Multimodal Vectors**.

Unlike traditional streaming systems that trap users in repetitive recommendation loops or rely on costly third-party recognition APIs, SoundGraph introduces:
1. **Hexa-Sonic v2 Disentangled Audio Recognition Engine**: A native, self-hosted acoustic architecture with **Zero Paid API dependencies** (no Shazam, ACRCloud, or AudD fees). It pairs a high-speed Tier 1 landmark index (resolving 100M+ commercial songs in ~1.2s) with multi-stream disentangled acoustic decoders: scale/pitch-invariant constellation hashes, Numba-compiled Subsequence DTW (S-DTW) note-onset vectors for off-key humming, phonetic vowel-skeleton lyrics alignment, rhythm tempograms, and a Chimeric Arbiter for mashups.
2. **Autonomous Graph-RAG Curation**: Multi-Centroid Spherical K-Means clusters listening histories into distinct acoustic personas, while an online contextual multi-armed bandit (LinUCB) balances familiar favorites against uncharted frontier discoveries.
3. **Cross-Platform Tactile Interfaces**: A 3D Levitating Card Deck available both on the web (React 18 / Vite 5) and as a high-performance native mobile application (React Native / Expo SDK 54) featuring real-time 30-second AAC previews, an offline vault, and a snappy 6-second Acoustic Lens.
4. **100% Free Production Deployment**: Designed from the ground up to deploy across perpetual free-tier cloud infrastructure (Render / Koyeb Docker backend, Vercel frontend, Neo4j AuraDB Free, Upstash Redis, and Expo EAS Free APK builds).

---

## 🏗️ Master Architectural Blueprint

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT INTERACTION PLATFORMS                              │
│                                                                                        │
│   Web Application (React 18 / Vite 5)            Native Mobile App (Expo SDK 54)       │
│   • 3D Levitating Tactile Deck (CardDeck3D)      • 3D Reanimated Gesture Card Deck     │
│   • WebGL Force-Directed Taste Graph             • Acoustic Lens with 6s Snappy Timer  │
│   • Acoustic Lens & Visual Vibe Search           • Local Offline Vault (AsyncStorage)  │
│   • Vibe Assistant with Real-Time Audio Player   • Standalone Android APK (EAS Free)   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ REST & WebSocket (/ws/live)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       FASTAPI HIGH-CONCURRENCY BACKEND GATEWAY                         │
│   • Port 8001 / Production Docker (Python 3.11 + Node.js 20 + FFmpeg)                  │
│   • Non-blocking async endpoints with Pydantic v2 schemas                              │
│   • Token refresh managers for Spotify OAuth & Google YouTube Data API v3              │
└─────────────────────────────────────┬───────────────────┬──────────────────────────────┘
                                      │                   │
                   ┌──────────────────┘                   └──────────────────┐
                   ▼                                                         ▼
┌──────────────────────────────────────────────┐ ┌──────────────────────────────────────────────┐
│  HEXA-SONIC v2 ACOUSTIC RECOGNITION ENGINE   │ │     GRAPH-RAG & HYBRID TASTE ENGINE          │
│  (100% Native · Zero Paid Recognition APIs)  │ │                                              │
│                                              │ │  1. Multi-Centroid Persona Clustering        │
│  • Tier 1: Global Landmark Signature Matcher │ │     (Spherical K-Means on 768-D embeddings)  │
│    (100M+ songs resolved in ~1.2s)           │ │  2. LinUCB Contextual Multi-Armed Bandit     │
│  • Stream A: Spectral Constellation Hashing  │ │     (Exploit, Graph Neighborhood, Discovery) │
│    (Scale/Pitch Invariant Triplet Ratios)    │ │  3. Graph Data Science (GDS) Algorithms:     │
│  • Stream B: Note-Onset Melody S-DTW (Numba) │ │     • PageRank centrality on artist nodes    │
│    (Humming, singing, whistled tunes)        │ │     • Louvain community modularity           │
│  • Stream C: Phonetic Vowel-Skeleton Lyrics  │ │     • NodeSimilarity topological Jaccard     │
│    (RapidFuzz alignment, mumble-tolerant)    │ │     • Dijkstra shortest-path taste bridges   │
│  • Stream D: Multi-Scale Rhythm Tempograms   │ │  4. AIFlowChainer: Hamiltonian Transitions   │
│  • JIT Hydration: YouTube Music & iTunes CDN │ │  5. Autonomous Catalog FrontierFetcher       │
│  • Chimeric Arbiter: Mashup Disentanglement  │ │  6. Gemini Multimodal Latent Space (768-D)   │
└──────────────────────┬───────────────────────┘ └──────────────────────┬───────────────────────┘
                       │                                                │
                       └───────────────────────┬────────────────────────┘
                                               │
                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                            DATA PERSISTENCE & CACHE FABRIC                             │
│                                                                                        │
│   Neo4j Knowledge Graph (AuraDB Free)            Redis In-Memory Cache (Upstash Free)  │
│   • 200,000 Nodes · 400,000 Relationships        • Real-time session ledger & tokens   │
│   • HNSW 768-D Vector Index (`track_embeddings`) • Ingestion progress & WebSocket bus │
│   • Transactional Cypher UNWIND batch ingestion  • Deduplication hash lookups          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Hexa-Sonic v2 Audio Recognition Engine

The **Hexa-Sonic v2** engine solves the Query-by-Humming (QBH) and universal audio identification problem without paying thousands of dollars for proprietary third-party APIs. It processes audio through a cascading, multi-stream architecture:

```
                          Incoming Audio Snippet (Web / Mobile)
                                          │
                                          ▼
                      ┌──────────────────────────────────────┐
                      │    AcousticBusRouter Normalizer      │
                      │  (Mono 22.05 kHz · Peak Normalization)
                      └──────────────────┬───────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   ┌───────────────────────────┐                   ┌───────────────────────────┐
   │ Tier 1: Landmark Search   │                   │ Tier 2: Disentangled Core │
   │ • Binary signature hashes │                   │ • Multi-Stream Extraction │
   │ • 100M+ global catalog    │                   │ • Deep acoustic profiles  │
   │ • Response time: ~1.2s    │                   │ • Humming & singing focus │
   └─────────────┬─────────────┘                   └─────────────┬─────────────┘
                 │ (If confidence >= 0.70)                       │
                 ├───────────────────────────────────────────────┤
                 │                                               │
                 ▼                                               ▼
         [Instant Return]                       ┌─────────────────────────────────┐
                                                │ Stream A: Constellation Hashes  │
                                                │ Stream B: Note-Onset S-DTW      │
                                                │ Stream C: Vowel-Skeleton Lyrics │
                                                │ Stream D: Rhythm Tempograms     │
                                                └────────────────┬────────────────┘
                                                                 │
                                                                 ▼
                                                ┌─────────────────────────────────┐
                                                │        Chimeric Arbiter         │
                                                │ • Fuses multi-stream confidence │
                                                │ • Resolves mashups / medleys    │
                                                │ • JIT Hydration via YT / iTunes │
                                                └─────────────────────────────────┘
```

### 1. Tier 1: High-Speed Landmark Matching
- Generates frequency-time peak landmark pairs converted into standard binary signature hashes.
- Queries global music catalogs across 100,000,000+ commercial tracks in ~1.2 seconds with **zero paid credentials**.
- Returns official metadata, track title, artist, album art, and Apple Music / YouTube Music identifiers.

### 2. Stream A: Scale-Invariant Constellation Fingerprinting
- **Algorithm**: Panako/Olaf triplet ratio hashing over spectral peaks.
- **Invariance**: Uses log-frequency interval ratios $\Delta c = \log(f_2 / f_1)$ and temporal intervals $R_t = (t_3 - t_2) / (t_2 - t_1)$.
- **Robustness**: Uniform pitch-shifts (e.g. Nightcore +2 semitones) and tempo scalings (e.g. 1.15x speed) mathematically cancel out, allowing identification under extreme speed, pitch, and room reverb variations in under 200ms.

### 3. Stream B: Note-Onset Melody Subsequence-DTW (Query-by-Humming)
- **Algorithm**: Monophonic pitch contour extraction (RMVPE / Pyin) followed by adaptive note-onset segmentation.
- **Pitch-Drift Invariance**: Converts absolute pitch into pitch delta vectors:
  $$\Delta p_i = p_i - p_{i-1}$$
  Canceling out off-key singing, singer vocal range differences, and gradual pitch drift.
- **Rhythm Invariance**: Inter-Onset Interval (IOI) ratios normalize tempo fluctuations and expressive rubato pauses.
- **Numba JIT Acceleration**: Subsequence Dynamic Time Warping (S-DTW) path costs are compiled into machine code with `@njit(fastmath=True)`, searching canonical database melodies in parallel in under 50ms.

### 4. Stream C: Phonetic Vowel-Skeleton Lyrics Alignment
- Extracts phonetic vowel tokens (`AA`, `IY`, `UW`, `EH`, `OW`, etc.) using acoustic formant centroids.
- Aligns user utterances against canonical syllable skeletons via **RapidFuzz Levenshtein Alignment**.
- Correctly identifies songs even when a user sings phonetically mumbled or incorrect lyrics with 50%+ syllable drift.

### 5. Stream D: Rhythm Tempograms & Beat Interval Invariance
- Multi-scale cyclic tempogram vectors capture percussive accents and rhythmic cadence independently of melodic pitch.
- Enables drum-beat and rhythm-tapping song retrieval.

### 6. Universal Prospective JIT Hydration
- When a candidate song is identified that does not yet have a rich local acoustic fingerprint in Neo4j, the engine triggers **Parallel JIT Hydration**.
- Fetches preview audio directly from official iTunes/YouTube Music CDNs, computes all 4 stream representations, and writes them transactionally into the local canonical database in background worker threads.

### 7. Chimeric Arbiter
- Fuses cross-stream confidence scores using calibrated weight matrices.
- Disentangles mashups, DJ transitions, and multi-track audio snippets by identifying temporal segment splits (e.g., *Track A playing at 0:00–0:05 and Track B entering at 0:05–0:10*).

---

## 📱 Cross-Platform Mobile Client (Expo SDK 54)

Located in `mobile/`, the SoundGraph mobile application provides a commercial, standalone Android/iOS experience:

<div align="center">
  <img src="frontend/public/soundgraph_logo.jpg" width="90" style="border-radius: 20px;" />
  <p><em>Built with React Native, Expo SDK 54, React Native Reanimated 3, and Gesture Handler</em></p>
</div>

### Key Capabilities
- **3D Levitating Card Deck**: Native gesture-driven deck physics with 60 FPS spring animations, tactile haptic feedback, 30-second AAC streaming, and real-time like/pass logging.
- **Snappy Acoustic Lens**: 
  - Direct microphone capture configured for mono 22.05 kHz audio.
  - **Snappy 6-second auto-stop** countdown timer with real-time waveform pulsing.
  - **3-second early-stop probe badge**: `⚡ Tap Orb to identify now • 0:03 / 0:06` allows users to trigger immediate recognition once enough audio has been gathered.
- **Offline Vault**: Uses `@react-native-async-storage/async-storage` to cache liked tracks, persona centroids, and audio previews locally for offline flights and underground transit.
- **Multi-Hub Navigation**: Seamless bottom tab bar switching between **Discover Deck**, **Acoustic Lens**, **Taste Graph**, **Offline Vault**, and **Settings**.
- **Dynamic API Switching**: Supports zero-recompile backend routing via `EXPO_PUBLIC_API_BASE` or the in-app server address switcher.

---

## 📐 Neo4j Graph Schema & Relationship Topology

```
                  ┌───────────────┐
                  │    (:User)    │
                  └───┬───────┬───┘
                      │       │
       [:CREATED_DECK]│       │[:LISTENED_TO {play_count, last_played}]
                      ▼       ▼
               ┌─────────┐  ┌─────────┐
               │ (:Deck) │  │(:Track) │
               └────┬────┘  └──┬───┬──┘
                    │          │   │
        [:CONTAINS] │          │   │[:BY]
                    │          │   ▼
                    │          │ ┌──────────┐
                    │          │ │ (:Artist)│
                    │          │ └──┬───────┘
                    │          │    │
                    │   [:IN_GENRE] │[:IN_GENRE]
                    │          │    │
                    ▼          ▼    ▼
                    ┌──────────────┐
                    │   (:Genre)   │
                    └──────────────┘
```

### Node Specifications

| Node Label | Core Properties | Description |
| :--- | :--- | :--- |
| `(:User)` | `id`, `name`, `source`, `avatar_url`, `created_at` | User identity node (supports unified multi-platform accounts). |
| `(:Track)` | `id`, `name`, `source`, `cover_url`, `preview_url`, `energy`, `valence`, `tempo`, `embedding` (768-D) | Canonical track representation with high-res cover art and audio preview streams. |
| `(:Artist)` | `id`, `name`, `source`, `pagerank`, `community` | Music artists with GDS PageRank centrality metrics. |
| `(:Genre)` | `name` | Normalized musical genre anchors (e.g. `synthwave`, `hip hop`, `indie rock`). |
| `(:Album)` | `id`, `name` | Album entity connected via `[:IN_ALBUM]`. |
| `(:Deck)` | `id`, `name`, `prompt`, `vibe`, `created_at`, `is_auto_replenish` | User-created and saved personalized card decks. |
| `(:MoodQuery)` | `prompt`, `timestamp` | Recorded natural-language query nodes representing expressed taste intent. |

### Vector Index Definition
```cypher
CREATE VECTOR INDEX track_embeddings IF NOT EXISTS
FOR (t:Track) ON (t.embedding)
OPTIONS {
  indexConfig: {
    `vector.dimensions`: 768,
    `vector.similarity_function`: 'cosine'
  }
}
```

---

## 🧠 Core Algorithmic Discovery Engines

### 1. Multi-Centroid Taste Persona Clustering (`PersonaClusterer`)
Rather than reducing a user to a single average vector, SoundGraph applies **Spherical K-Means** to listened track embeddings. It extracts up to 3 distinct centroids representing separate musical personas (e.g., *Late-Night Hip Hop*, *French House / Synthwave*, *Acoustic Bollywood*). Each persona centroid queries the Neo4j HNSW vector index independently.

### 2. Contextual Multi-Armed Bandit (`ContextualLinUCB`)
To eliminate repetitive filter bubbles, an online **LinUCB** bandit algorithm balances:
- **Arm 0 (Exploit)**: Candidates from multi-centroid taste personas.
- **Arm 1 (Graph Proximity)**: Candidates connected via topological `SIMILAR_TO` edges.
- **Arm 2 (Catalog Diversity)**: Broad catalog backfill.
- **Arm 3 (Frontier Wildcard)**: Dynamic exploratory leaps into unvisited genres.

Feedback is updated in real time via **implicit dwell time** (continuous tracking of preview playback duration) and **explicit swipes** (`+1.0` for like, `-1.0` for pass).

### 3. Harmonic Flow Chaining (`AIFlowChainer`)
Before presenting cards to the user, SoundGraph solves a local Hamiltonian path problem across candidate vectors. Tracks are arranged so that consecutive cards transition harmonically in acoustic energy and valence, creating the feeling of a seamless DJ progression rather than an erratic shuffle.

---

## 🔌 API Blueprint

### Audio Recognition & Hexa-Sonic (`/audio`, `/vibe`)
- `POST /audio/identify`: High-concurrency Hexa-Sonic v2 endpoint. Accepts binary audio uploads (WAV, MP3, M4A, WebM), evaluates Tier 1 Landmark and Streams A/B/C/D, and returns identified track metadata, confidence, and match stream breakdown.
- `POST /vibe/identify-audio`: Backward-compatible Acoustic Lens audio recognition endpoint.
- `POST /vibe/image`: Visual vibe search projecting images into matching musical tracks via Gemini 768-D embeddings.
- `POST /audio/hydrate`: Triggers parallel background JIT hydration for a specific song ID or YouTube URL.

### Authentication & Sessions (`/auth`)
- `GET /auth/spotify/login`: Initiates Spotify OAuth authorization flow.
- `GET /auth/spotify/callback`: Exchanges authorization code, saves tokens with silent refresh, and initializes profile.
- `POST /auth/spotify/credentials`: Dynamically configures client credentials at runtime.
- `GET /auth/google/login`: Initiates Google / YouTube OAuth authorization flow.
- `GET /auth/google/callback`: Exchanges Google OAuth code and initializes profile.
- `POST /auth/google/credentials`: Configures Google client credentials at runtime.
- `GET /auth/me`: Returns current user session state, active platform connections, and token status.
- `POST /auth/logout`: Clears Redis session caches.

### Ingestion Pipeline (`/ingest`)
- `POST /ingest/spotify`: Asynchronously ingests user top tracks, saved songs, and playlists.
- `POST /ingest/youtube`: Ingests YouTube Music Liked Music (`LM`) and user playlists with full pagination.
- `POST /ingest/youtube/sync`: Synchronizes custom YouTube playlist URLs or search terms.
- `POST /ingest/demo`: Seeds canonical multi-genre demo dataset into Neo4j and executes GDS algorithms.

### Recommendations & Discovery (`/recommendations`)
- `GET /recommendations`: Fetches an infinite stream of candidate cards. Supports `exclude_ids`, `mood` (`euphoric`, `melancholic`, `chill`, `high_energy`), and `limit`.
- `POST /recommendations/feedback`: Records user swipe actions (`reward: +1.0` or `-1.0`) to update graph weights.
- `POST /telemetry/dwell`: Records continuous playback dwell time to optimize bandit policies.
- `GET /user/taste-profile`: Returns user top artists, top playlists, likes/dislikes ledger, and acoustic averages.
- `GET /library`: Returns ingested library tracks with mood filters, search, and sorting strategies.
- `GET /recommendations/explain/{track_id}`: Returns human-readable explanation of why a track was recommended.

### Graph Data Science & Analytics (`/graph`, `/artists`)
- `GET /graph/stats`: Returns node counts, edge counts, and graph density statistics.
- `GET /graph/visualize`: Returns WebGL node-link data for 2D/3D force-directed graph visualization.
- `GET /artists/top`: Returns PageRank centrality rankings of catalog artists.
- `GET /shortest-path`: Finds the Dijkstra shortest path between any two artists in the taste graph.

### Real-Time Streaming
- `WS /ws/live`: Full-duplex WebSocket connection delivering real-time ingestion progress, live frontier candidates, and GDS algorithm execution events.

---

## ☁️ 100% Free Production Deployment Guide

You can deploy the entire SoundGraph ecosystem with **$0 monthly spend** using perpetual free tiers:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Vercel Frontend │ ----> │  Render Backend │ ----> │ Neo4j AuraDB    │
│ (React 18 SPA)  │       │  (FastAPI Docker│       │ (Graph Database)│
└─────────────────┘       │   + FFmpeg)     │       └─────────────────┘
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Upstash Redis  │
                          │  (Serverless)   │
                          └─────────────────┘
```

### 1. Database: Neo4j AuraDB Free
1. Sign up at [neo4j.com/cloud/aura-free](https://neo4j.com/cloud/aura-free).
2. Create an **AuraDB Free** instance (supports 200,000 nodes and 400,000 relationships perpetually for $0).
3. Save your connection credentials:
   - `NEO4J_URI=neo4j+s://<your-db-id>.databases.neo4j.io`
   - `NEO4J_USER=neo4j`
   - `NEO4J_PASSWORD=<your-generated-password>`

### 2. Cache: Upstash Redis Free
1. Sign up at [upstash.com](https://upstash.com).
2. Create a free Redis database (10,000 requests/day free).
3. Copy your `rediss://...` connection string:
   - `REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379`

### 3. Backend: Render.com / Koyeb (Docker)
1. Push your SoundGraph repository to GitHub.
2. Sign up at [render.com](https://render.com) and create a **New Web Service**.
3. Connect your GitHub repository and select **Docker** as the runtime environment (Render will automatically detect the root `Dockerfile`).
4. Set the following environment variables in the Render dashboard:
   ```env
   PORT=8001
   NEO4J_URI=neo4j+s://<your-aura-id>.databases.neo4j.io
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=<your-neo4j-password>
   REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379
   FRONTEND_URL=https://your-soundgraph.vercel.app
   ```
5. Deploy the service. Your backend API will be available at: `https://your-service.onrender.com`

### 4. Frontend: Vercel / Netlify
1. Sign up at [vercel.com](https://vercel.com) and click **Add New Project**.
2. Import your GitHub repository:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Under **Environment Variables**, add:
   ```env
   VITE_API_BASE=https://your-service.onrender.com
   ```
4. Deploy. Your web app is live on a global CDN at `https://your-soundgraph.vercel.app`.

### 5. Mobile: Standalone Android APK via Expo EAS Free
1. Install the EAS CLI:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. Navigate to `mobile/` and link your Expo project:
   ```bash
   cd mobile
   eas init
   ```
3. Set your production backend URL in `mobile/app.json`:
   ```json
   {
     "expo": {
       "extra": {
         "eas": {
           "projectId": "<your-project-id>"
         }
       }
     }
   }
   ```
4. Run a free cloud APK build (Expo provides 15–30 free cloud builds per month):
   ```bash
   EXPO_PUBLIC_API_BASE=https://your-service.onrender.com eas build -p android --profile preview
   ```
5. When complete, download and install the `.apk` directly onto any Android device!

---

## 🚀 Local Installation & Setup

### 1. Prerequisites
- **Neo4j Database**: Version 2026.09+ with APOC & GDS plugins (or Neo4j AuraDB).
- **Redis**: Local or cloud instance.
- **Python**: 3.10+ (tested on Python 3.11, 3.12, and 3.14).
- **Node.js**: 18+ with `npm`.
- **FFmpeg**: Required for audio transcoding and landmark extraction (`sudo apt install ffmpeg`).

### 2. Environment Configuration
Create a `.env` file in the project root:
```env
# Neo4j Graph Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
NEO4J_DATABASE=neo4j

# Cache
REDIS_URL=redis://localhost:6379/0

# Optional Spotify Developer App
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8001/auth/spotify/callback

# Optional Google / YouTube OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:8001/auth/google/callback

# Google Gemini API Key (For visual vibe search and 768-D vectors)
GEMINI_API_KEY=your_gemini_api_key

# Application Settings
FRONTEND_URL=http://localhost:5173
API_PORT=8001
API_HOST=0.0.0.0
```

### 3. Backend Setup
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies (includes Numba, Librosa, RapidFuzz, yt-dlp)
pip install -r backend/requirements.txt

# Start FastAPI server on port 8001
PYTHONPATH=. uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload
```
Interactive OpenAPI documentation will be accessible at: `http://localhost:8001/docs`

### 4. Frontend Setup (Web)
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```
The web application will be live at: `http://localhost:5173`

### 5. Mobile Setup (React Native / Expo)
```bash
cd mobile
npm install
npx expo start
```
Scan the displayed QR code using the **Expo Go** app on your phone, or press `a` to run in an Android emulator.

### 6. Production Docker Setup
```bash
# Build the multi-stage Docker image
docker build -t soundgraph:latest .

# Run container on port 8001
docker run -p 8001:8001 --env-file .env soundgraph:latest
```

---

## 🧪 Testing & Validation Suite

SoundGraph includes automated regression and acoustic invariant tests:

```bash
# Run Hexa-Sonic v2 acoustic verification suite
PYTHONPATH=. pytest tests/test_hexa_sonic.py -v
```

### Test Assertions Covered
- `test_speaker_reverb_and_nightcore`: Validates Stream A triplet ratio invariance against a 1.10x speedup and +2 semitone shift with room reverberation. Resolves in `< 250ms`.
- `test_off_key_rubato_humming`: Validates Stream B Subsequence DTW against an off-key hum shifted by +5 semitones with gradual pitch drift and 30% tempo rubato.
- `test_mumbled_50_percent_lyrics`: Validates Stream C phonetic vowel skeleton alignment with >50% phonetic syllable mutations.
- `test_chimeric_mashup_starboy_snooze`: Validates Chimeric Arbiter detection and temporal segmentation across a hybrid mashup.
- `test_canonical_deduplication`: Validates idempotent canonical track and melody ingestion.

---

## 📄 License
This project is open-source software licensed under the [MIT License](LICENSE).
