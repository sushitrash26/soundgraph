from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from typing import Optional
from backend.core.logger import logger
from backend.graph.loader import GraphLoader
from backend.ingestors.spotify_ingestor import SpotifyIngestor
from backend.ingestors.youtube_ingestor import YouTubeMusicIngestor
from backend.ingestors.google_youtube_ingestor import GoogleYouTubeIngestor
from backend.api.routes.auth import SESSION_STORE
from backend.api.websocket import ws_manager
from backend.gds.projections import GDSProjectionManager
from backend.gds.similarity import GDSSimilarity
from backend.gds.pagerank import GDSPageRank
from backend.gds.community import GDSCommunity

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

async def run_gds_pipeline_async():
    try:
        await ws_manager.broadcast({"type": "gds_progress", "status": "Projecting taste graph..."})
        GDSProjectionManager.project_taste_graph()

        await ws_manager.broadcast({"type": "gds_progress", "status": "Running GDS NodeSimilarity..."})
        GDSSimilarity.run_node_similarity()

        await ws_manager.broadcast({"type": "gds_progress", "status": "Computing PageRank centrality..."})
        GDSPageRank.run_pagerank()

        await ws_manager.broadcast({"type": "gds_progress", "status": "Clustering Louvain communities..."})
        GDSCommunity.run_louvain()

        await ws_manager.broadcast({
            "type": "gds_complete", 
            "status": "GDS Algorithms Finished!",
            "message": "Graph relationships and centrality updated successfully."
        })
    except Exception as e:
        logger.error(f"GDS async execution error: {e}")
        await ws_manager.broadcast({"type": "gds_error", "error": str(e)})

@router.post("/spotify")
async def ingest_spotify(background_tasks: BackgroundTasks):
    token = SESSION_STORE.get("spotify_token")
    if not token:
        raise HTTPException(status_code=401, detail="Spotify is not authenticated. Please login via /auth/spotify/login or use /ingest/demo")

    async def _do_spotify_ingest():
        try:
            await ws_manager.broadcast({"type": "ingestion_progress", "stage": "spotify", "status": "Connecting to Spotify API..."})
            ingestor = SpotifyIngestor(auth_token=token)
            profile = ingestor.fetch_user_profile()
            GraphLoader.upsert_user(profile)

            await ws_manager.broadcast({"type": "ingestion_progress", "stage": "spotify", "status": "Ingesting tracks and audio features..."})
            tracks = ingestor.fetch_listening_data()
            count = GraphLoader.load_tracks_batch(profile["id"], tracks)

            await ws_manager.broadcast({"type": "ingestion_progress", "stage": "spotify", "status": f"Loaded {count} Spotify tracks. Running GDS algorithms..."})
            await run_gds_pipeline_async()

            await ws_manager.broadcast({"type": "ingestion_complete", "source": "spotify", "tracks_count": count})
        except Exception as e:
            logger.error(f"Spotify ingestion error: {e}")
            await ws_manager.broadcast({"type": "ingestion_error", "error": str(e)})

    background_tasks.add_task(_do_spotify_ingest)
    return {"status": "started", "message": "Spotify ingestion launched in background."}

@router.post("/youtube")
async def ingest_youtube(background_tasks: BackgroundTasks):
    google_token = SESSION_STORE.get("google_token")
    headers = SESSION_STORE.get("youtube_headers")

    async def _do_youtube_ingest():
        try:
            await ws_manager.broadcast({"type": "ingestion_progress", "stage": "youtube", "status": "Connecting to YouTube Music..."})
            if google_token:
                g_ingestor = GoogleYouTubeIngestor(access_token=google_token)
                profile = await g_ingestor.fetch_user_profile()
                GraphLoader.upsert_user(profile)
                tracks = await g_ingestor.fetch_listening_data()
                count = GraphLoader.load_tracks_batch(profile["id"], tracks)
            else:
                ingestor = YouTubeMusicIngestor(auth_headers=headers)
                profile = ingestor.fetch_user_profile()
                GraphLoader.upsert_user(profile)
                tracks = ingestor.fetch_listening_data()
                count = GraphLoader.load_tracks_batch(profile["id"], tracks)

            await ws_manager.broadcast({"type": "ingestion_progress", "stage": "youtube", "status": f"Loaded {count} YouTube tracks. Running GDS algorithms..."})
            await run_gds_pipeline_async()

            await ws_manager.broadcast({"type": "ingestion_complete", "source": "youtube", "tracks_count": count})
        except Exception as e:
            logger.error(f"YouTube ingestion error: {e}")
            await ws_manager.broadcast({"type": "ingestion_error", "error": str(e)})

    background_tasks.add_task(_do_youtube_ingest)
    return {"status": "started", "message": "YouTube Music ingestion launched in background."}

@router.post("/youtube/sync")
async def sync_youtube_custom(request: Request, background_tasks: BackgroundTasks):
    """Sync YouTube Music via Playlist URL or Artist/Genre Search term"""
    body = await request.json()
    user_id = body.get("user_id", "astitva_demo_user")
    playlist_url = body.get("playlist_url")
    artists_search = body.get("artists_search")

    async def _do_custom_yt():
        try:
            ingestor = YouTubeMusicIngestor()
            tracks = []
            if playlist_url:
                await ws_manager.broadcast({"type": "ingestion_progress", "stage": "youtube", "status": f"Fetching YouTube playlist: {playlist_url[:40]}..."})
                tracks = ingestor.fetch_playlist_tracks(playlist_url)
            elif artists_search:
                await ws_manager.broadcast({"type": "ingestion_progress", "stage": "youtube", "status": f"Searching YouTube Music for: {artists_search}..."})
                tracks = ingestor.fetch_search_tracks(artists_search, limit=20)
            else:
                tracks = ingestor.fetch_listening_data()

            if not tracks:
                # Seed fallback popular tracks if search returns empty
                tracks = ingestor.fetch_search_tracks("Synthwave Hits", limit=10)

            await ws_manager.broadcast({"type": "ingestion_progress", "stage": "youtube", "status": f"Ingesting {len(tracks)} YouTube Music tracks into Neo4j..."})
            count = GraphLoader.load_tracks_batch(user_id, tracks)

            await ws_manager.broadcast({"type": "ingestion_progress", "stage": "youtube", "status": "Running GDS algorithms on updated taste graph..."})
            await run_gds_pipeline_async()

            await ws_manager.broadcast({"type": "ingestion_complete", "source": "youtube", "tracks_count": count})
        except Exception as e:
            logger.error(f"YouTube sync error: {e}")
            await ws_manager.broadcast({"type": "ingestion_error", "error": str(e)})

    background_tasks.add_task(_do_custom_yt)
    return {"status": "started", "message": "Custom YouTube sync started."}

@router.post("/demo")
async def ingest_demo(background_tasks: BackgroundTasks):
    """Instant one-click seeding of cross-platform Spotify + YouTube taste graph"""
    async def _do_demo_seed():
        try:
            await ws_manager.broadcast({"type": "ingestion_progress", "stage": "demo", "status": "Seeding unified Spotify & YouTube taste graph..."})
            res = GraphLoader.seed_mock_dataset("astitva_demo_user")
            
            await ws_manager.broadcast({"type": "ingestion_progress", "stage": "demo", "status": f"Seeded {res['tracks_loaded']} tracks across Electronic, Rock, HipHop, Bollywood. Running GDS..."})
            await run_gds_pipeline_async()

            await ws_manager.broadcast({
                "type": "ingestion_complete",
                "source": "demo_seed",
                "tracks_count": res["tracks_loaded"]
            })
        except Exception as e:
            logger.error(f"Demo seed error: {e}")
            await ws_manager.broadcast({"type": "ingestion_error", "error": str(e)})

    background_tasks.add_task(_do_demo_seed)
    return {"status": "started", "message": "Cross-platform taste graph seed started."}
