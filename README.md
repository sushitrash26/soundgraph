# 🎵 SoundGraph

<div align="center">
  <img src="frontend/public/soundgraph_logo.jpg" alt="SoundGraph Logo" width="120" style="border-radius: 28px; box-shadow: 0 0 40px rgba(168, 85, 247, 0.4);" />

  ### Cross-Platform Music Taste Knowledge Graph
  **Unified Graph Data Science (GDS) · Spotify & YouTube Music Telemetry · Real-Time Audio DNA**

  [![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
  [![Neo4j](https://img.shields.io/badge/Neo4j-2026.09-008CC1?logo=neo4j&logoColor=white)](https://neo4j.com/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
  [![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
  [![Vite](https://img.shields.io/badge/Vite-5+-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
</div>

---

## 🌟 Overview

**SoundGraph** unifies heterogeneous music listening history and telemetry from **Spotify** (OAuth PKCE) and **YouTube Music** (`ytmusicapi` & Google OAuth) into a standardized property knowledge graph powered by **Neo4j Graph Data Science (GDS)**. 

By analyzing the underlying topology of your listening habits—rather than relying solely on black-box vector embeddings—SoundGraph computes structural similarity, detects emergent musical sub-culture communities, surfaces graph centrality rankings, and produces fully explainable music recommendations with real-time interactive visual graphs.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   INGESTION LAYER                      │
│   Spotify OAuth API            YouTube Music API       │
│  (Top tracks, audio features, (Liked songs, history,   │
│   recently played)             playlists)              │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│               UNIFIED GRAPH ETL PIPELINE               │
│  • Entity deduplication across heterogeneous ID spaces │
│  • Topological normalizer & Audio DNA feature matrix   │
│  • High-throughput Cypher UNWIND transactional loader  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   NEO4J GRAPH DB                       │
│  (:User)-[:LISTENED_TO]->(:Track)-[:BY]->(:Artist)     │
│  (:Track)-[:IN_GENRE]->(:Genre)                        │
│  (:Track)-[:SIMILAR_TO {score}]->(:Track)              │
│  (:Artist)-[:IN_GENRE]->(:Genre)                       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│              GRAPH DATA SCIENCE (GDS)                  │
│  1. gds.nodeSimilarity: High-order Jaccard similarity  │
│  2. gds.pageRank: Artist & track graph centrality      │
│  3. gds.louvain: Latent community vibe clustering      │
│  4. gds.shortestPath: Dijkstra taste bridges           │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│           FASTAPI BACKEND + WEBSOCKET ENGINE           │
│  • Async REST endpoints & Cypher query engine          │
│  • Real-time /ws/live mutation & recommendation stream │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                  REACT 18 FRONTEND                     │
│  • WebGL 2D Force-Directed Graph (react-force-graph)   │
│  • Audio DNA radar charts (Recharts)                   │
│  • Explainable AI recommendation cards                 │
│  • Dijkstra Shortest-Path Taste Bridge Explorer        │
└────────────────────────────────────────────────────────┘
```

---

## ⚡ Key Features

- **Cross-Platform Telemetry Merging**: Ingests your Spotify saved library and YouTube Music likes into a singular deduplicated node graph.
- **Topological Similarity (`gds.nodeSimilarity`)**: Connects tracks through directional `SIMILAR_TO` edges weighted by shared genre and artist neighborhood topology.
- **Influence Centrality (`gds.pageRank`)**: Identifies core anchor artists driving your listening preferences.
- **Vibe Clustering (`gds.louvain`)**: Uncovers emergent acoustic clusters without requiring manual tagging.
- **Taste Bridge Explorer (Dijkstra Shortest Path)**: Finds the shortest topological path between any two disparate artists (e.g. *Daft Punk* to *Arijit Singh*).
- **Explainable Recommendations**: Every recommended track explains exactly *why* it was chosen, tracing graph paths and shared attributes.
- **Real-Time Live Feed**: WebSocket streaming updates your graph live as new songs are ingested.

---

## 🧠 Graph Data Science Algorithms

### 1. Track Node Similarity (`gds.nodeSimilarity`)
```cypher
CALL gds.nodeSimilarity.write('trackGraph', {
    writeRelationshipType: 'SIMILAR_TO',
    writeProperty: 'score',
    topK: 10,
    similarityCutoff: 0.05
})
```

### 2. Artist Graph Centrality (`gds.pageRank`)
```cypher
CALL gds.pageRank.write('trackGraph', {
    writeProperty: 'pagerank',
    maxIterations: 20,
    dampingFactor: 0.85
})
```

### 3. Latent Community Detection (`gds.louvain`)
```cypher
CALL gds.louvain.write('trackGraph', {
    writeProperty: 'community'
})
```

### 4. Dijkstra Shortest-Path Taste Bridge
```cypher
MATCH (a1:Artist {name: $source}), (a2:Artist {name: $target})
MATCH p = shortestPath((a1)-[*]-(a2))
RETURN [n in nodes(p) | coalesce(n.name, n.title)] AS bridge
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Neo4j Database**: 2026.09+ with APOC & Graph Data Science (GDS) plugins
- **Python**: 3.10+
- **Node.js**: 18+

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your database and API credentials:
```bash
cp .env.example .env
```

### 3. Backend Setup
```bash
# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start FastAPI server on port 8001
PYTHONPATH=. uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload
```
Interactive OpenAPI documentation will be available at: `http://localhost:8001/docs`

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The user interface will be available at: `http://localhost:5173`

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
