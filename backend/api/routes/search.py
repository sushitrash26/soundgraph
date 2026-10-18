from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from backend.services.search_service import SearchService

router = APIRouter(prefix="/search", tags=["Search & Bridged Intelligence"])

class SearchBridgeRequest(BaseModel):
    query: str
    user_id: str = "astitva_demo_user"
    limit: int = 10

@router.get("/autocomplete")
def autocomplete(q: str = Query(..., min_length=1), limit: int = 8):
    """Instant auto-complete across Neo4j graph and live catalog"""
    return SearchService.autocomplete(query=q, limit=limit)

@router.get("/bridge")
async def search_and_bridge_get(
    q: str = Query(..., min_length=1),
    user_id: str = Query("astitva_demo_user"),
    limit: int = Query(10, ge=1, le=25)
):
    """
    Search for a song and generate an AI-bridged deck linking the song
    to the user's personal listening taste.
    """
    return await SearchService.search_and_bridge(query=q, user_id=user_id, limit=limit)

@router.post("/bridge")
async def search_and_bridge_post(payload: SearchBridgeRequest):
    """POST wrapper for bridged search deck creation"""
    return await SearchService.search_and_bridge(
        query=payload.query,
        user_id=payload.user_id,
        limit=payload.limit
    )
