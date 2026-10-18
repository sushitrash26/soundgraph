from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from backend.services.migration_service import MigrationService

router = APIRouter(prefix="/migration", tags=["Playlist Migration"])

class TrackResolveRequest(BaseModel):
    tracks: List[Dict[str, Any]]
    target_platform: str

class MigrationExecuteRequest(BaseModel):
    user_id: str = "astitva_demo_user"
    source_platform: str
    target_platform: str
    playlist_title: str
    description: Optional[str] = "Migrated via SoundGraph"
    privacy: Optional[str] = "private"
    tracks: List[Dict[str, Any]]
    method: Optional[str] = "direct"

@router.get("/profile")
def get_platform_profile(
    user_id: str = Query("astitva_demo_user"),
    platform: str = Query("youtube")
):
    return MigrationService.get_platform_profile(user_id=user_id, platform=platform)

@router.get("/playlists")
async def get_platform_playlists(
    user_id: str = Query("astitva_demo_user"),
    platform: str = Query("youtube")
):
    return await MigrationService.get_platform_playlists(user_id=user_id, platform=platform)

@router.post("/resolve")
async def resolve_tracks(payload: TrackResolveRequest):
    return await MigrationService.resolve_tracks_for_migration(
        tracks=payload.tracks,
        target_platform=payload.target_platform
    )

@router.post("/execute")
async def execute_migration(payload: MigrationExecuteRequest):
    return await MigrationService.execute_migration(
        user_id=payload.user_id,
        source_platform=payload.source_platform,
        target_platform=payload.target_platform,
        playlist_title=payload.playlist_title,
        description=payload.description or "Migrated via SoundGraph",
        privacy=payload.privacy or "private",
        tracks=payload.tracks,
        method=payload.method or "direct"
    )
