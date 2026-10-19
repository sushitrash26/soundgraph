import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.core.config import settings
from backend.core.logger import logger
from backend.core.neo4j_driver import neo4j_conn
from backend.graph.schema import init_schema
from backend.api.websocket import ws_manager
from backend.api.routes.auth import router as auth_router
from backend.api.routes.ingest import router as ingest_router
from backend.api.routes.recommend import router as recommend_router
from backend.api.routes.graph import router as graph_router
from backend.api.routes.search import router as search_router
from backend.api.routes.deck import router as deck_router
from backend.api.routes.migration import router as migration_router
from backend.api.routes.onboarding import router as onboarding_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SoundGraph API Server...")
    try:
        neo4j_conn.connect()
        init_schema()
        logger.info("Neo4j database connection and schema constraints verified.")
    except Exception as e:
        logger.error(f"Error during startup Neo4j initialization: {e}")
    yield
    logger.info("Shutting down SoundGraph API Server...")
    neo4j_conn.close()

app = FastAPI(
    title="SoundGraph API",
    description="Cross-Platform Music Taste Knowledge Graph with Neo4j GDS Recommendations",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for React frontend & Expo mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(auth_router)
app.include_router(ingest_router)
app.include_router(recommend_router)
app.include_router(graph_router)
app.include_router(search_router)
app.include_router(deck_router)
app.include_router(migration_router)
app.include_router(onboarding_router)

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming ping or client events
            await websocket.send_text(f'{{"type":"pong","received":{data}}}')
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client loop exception: {e}")
        ws_manager.disconnect(websocket)

@app.get("/")
def root():
    return {
        "service": "SoundGraph API",
        "status": "online",
        "documentation": "/docs",
        "websocket": "/ws/live"
    }

@app.get("/health")
def health():
    return {"status": "healthy", "neo4j": "connected"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)
