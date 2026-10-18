from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from backend.services.search_service import SearchService
from backend.api.routes.auth import SESSION_STORE

router = APIRouter(prefix="/search", tags=["Search & Bridged Intelligence"])

def resolve_uid(user_id: Optional[str] = None) -> str:
    """Dynamically resolves the active user ID from request or session store."""
    if user_id and user_id.strip():
        return user_id.strip()
    session_user = SESSION_STORE.get("current_user")
    if session_user and session_user.get("id"):
        return session_user["id"]
    return ""

class SearchBridgeRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    limit: int = 10

@router.get("/autocomplete")
def autocomplete(q: str = Query(..., min_length=1), limit: int = 8):
    """Instant auto-complete across Neo4j graph and live catalog"""
    return SearchService.autocomplete(query=q, limit=limit)

@router.get("/bridge")
async def search_and_bridge_get(
    q: str = Query(..., min_length=1),
    user_id: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=25)
):
    """
    Search for a song and generate an AI-bridged deck linking the song
    to the user's personal listening taste.
    """
    uid = resolve_uid(user_id)
    return await SearchService.search_and_bridge(query=q, user_id=uid, limit=limit)

@router.post("/bridge")
async def search_and_bridge_post(payload: SearchBridgeRequest):
    """POST wrapper for bridged search deck creation"""
    uid = resolve_uid(payload.user_id)
    return await SearchService.search_and_bridge(
        query=payload.query,
        user_id=uid,
        limit=payload.limit
    )
