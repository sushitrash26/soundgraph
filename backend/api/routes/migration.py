from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from backend.services.migration_service import MigrationService
from backend.api.routes.auth import SESSION_STORE

router = APIRouter(prefix="/migration", tags=["Playlist Migration"])

def resolve_uid(user_id: Optional[str] = None) -> str:
    """Dynamically resolves the user ID from request parameter or active session store."""
    if user_id and user_id.strip():
        return user_id.strip()
    session_user = SESSION_STORE.get("current_user")
    if session_user and session_user.get("id"):
        return session_user["id"]
    return ""

class TrackResolveRequest(BaseModel):
    tracks: List[Dict[str, Any]]
    target_platform: str

class MigrationExecuteRequest(BaseModel):
    user_id: Optional[str] = None
    source_platform: str
    target_platform: str
    playlist_title: str
    description: Optional[str] = "Migrated via SoundGraph"
    privacy: Optional[str] = "private"
    tracks: List[Dict[str, Any]]
    method: Optional[str] = "direct"

@router.get("/profile")
def get_platform_profile(
    user_id: Optional[str] = Query(None),
    platform: str = Query("youtube")
):
    uid = resolve_uid(user_id)
    if not uid:
        return {
            "platform": platform,
            "display_name": f"{platform.title()} Music Library",
            "total_tracks": 0,
            "top_artists": [],
            "top_genres": [],
            "radar": {"energy": 0.0, "valence": 0.0, "danceability": 0.0}
        }
    return MigrationService.get_platform_profile(user_id=uid, platform=platform)

@router.get("/playlists")
async def get_platform_playlists(
    user_id: Optional[str] = Query(None),
    platform: str = Query("youtube")
):
    uid = resolve_uid(user_id)
    if not uid:
        return []
    return await MigrationService.get_platform_playlists(user_id=uid, platform=platform)

@router.post("/resolve")
async def resolve_tracks(payload: TrackResolveRequest):
    return await MigrationService.resolve_tracks_for_migration(
        tracks=payload.tracks,
        target_platform=payload.target_platform
    )

@router.post("/execute")
async def execute_migration(payload: MigrationExecuteRequest):
    uid = resolve_uid(payload.user_id)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required to perform playlist migration.")
    return await MigrationService.execute_migration(
        user_id=uid,
        source_platform=payload.source_platform,
        target_platform=payload.target_platform,
        playlist_title=payload.playlist_title,
        description=payload.description or "Migrated via SoundGraph",
        privacy=payload.privacy or "private",
        tracks=payload.tracks,
        method=payload.method or "direct"
    )
