from fastapi import APIRouter, Query, Body, UploadFile, File, Form, HTTPException
import base64
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from backend.graph.queries import GraphQueries
from backend.services.acoustic_lens import AcousticLensService
from backend.services.event_logger import EventLogger
from backend.core.logger import logger
from backend.api.routes.auth import SESSION_STORE

router = APIRouter(tags=["Recommendations & Analytics"])

def resolve_uid(user_id: Optional[str] = None) -> str:
    """Dynamically resolves the active user ID from request or session store."""
    if user_id and user_id.strip():
        return user_id.strip()
    session_user = SESSION_STORE.get("current_user")
    if session_user and session_user.get("id"):
        return session_user["id"]
    return ""

class FeedbackRequest(BaseModel):
    user_id: Optional[str] = None
    track_id: str
    reward: float  # +1.0 for like, -1.0 for dislike
    impression_id: Optional[str] = None

class ChatRequest(BaseModel):
    user_id: Optional[str] = None
    prompt: str
    history: Optional[List[Dict[str, Any]]] = None

class ImageVibeRequest(BaseModel):
    user_id: Optional[str] = None
    image_base64: str
    mime_type: str = "image/jpeg"
    text_hint: Optional[str] = None

class AudioVibeRequest(BaseModel):
    user_id: Optional[str] = None
    audio_base64: str
    mime_type: Optional[str] = "audio/m4a"
    hint: Optional[str] = None

class DwellTelemetryRequest(BaseModel):
    user_id: Optional[str] = None
    track_id: str
    arm: Optional[int] = 0
    dwell_ms: int
    explicit_action: Optional[float] = None
    session_depth: int = 1
    hour: Optional[int] = None
    impression_id: Optional[str] = None
    tz_offset_minutes: Optional[int] = None

class EventItem(BaseModel):
    event_id: Optional[str] = None
    impression_id: Optional[str] = None
    user_id: Optional[str] = None
    track_id: str
    type: str  # impression, dwell_threshold, completion, like, dislike, skip, share, save
    value_ms: Optional[int] = None
    client_ts: Optional[str] = None
    app_version: Optional[str] = "1.0.0"

class BatchEventsRequest(BaseModel):
    events: List[EventItem]

@router.get("/user/taste-profile")
def get_user_taste_profile(user_id: Optional[str] = Query(None)):
    uid = resolve_uid(user_id)
    return GraphQueries.get_user_taste_profile(user_id=uid)

@router.get("/recommendations")
def get_recommendations(
    user_id: Optional[str] = Query(None), 
    limit: int = 15,
    exclude_ids: Optional[str] = Query(None, description="Comma-separated IDs already seen to enable infinite deck polling"),
    mood: Optional[str] = Query(None, description="Real-time mood filter: euphoric, melancholic, chill, high_energy")
):
    uid = resolve_uid(user_id)
    return GraphQueries.get_recommendations(
        user_id=uid, 
        limit=limit,
        exclude_ids=exclude_ids,
        mood=mood
    )

@router.post("/recommendations/feedback")
@router.post("/feedback")
def record_feedback(payload: FeedbackRequest):
    uid = resolve_uid(payload.user_id)
    res = GraphQueries.record_feedback(
        user_id=uid,
        track_id=payload.track_id,
        reward=payload.reward
    )
    try:
        from backend.services.event_logger import EventLogger
        ev_type = "like" if payload.reward > 0 else "dislike"
        EventLogger.get_instance().log_events([{
            "impression_id": payload.impression_id,
            "user_id": uid,
            "track_id": payload.track_id,
            "type": ev_type,
            "value_ms": None
        }])
    except Exception:
        pass
    return res

@router.post("/telemetry/dwell")
def record_dwell_telemetry(payload: DwellTelemetryRequest):
    uid = resolve_uid(payload.user_id)
    res = GraphQueries.record_dwell_telemetry(
        user_id=uid,
        track_id=payload.track_id,
        arm=payload.arm or 0,
        dwell_ms=payload.dwell_ms,
        explicit_action=payload.explicit_action,
        session_depth=payload.session_depth,
        hour=payload.hour,
        impression_id=payload.impression_id,
        tz_offset_minutes=payload.tz_offset_minutes
    )
    try:
        from backend.services.event_logger import EventLogger
        ev_type = "dwell_threshold" if payload.dwell_ms >= 5000 else "skip"
        EventLogger.get_instance().log_events([{
            "impression_id": payload.impression_id,
            "user_id": uid,
            "track_id": payload.track_id,
            "type": ev_type,
            "value_ms": payload.dwell_ms
        }])
    except Exception:
        pass
    return res

@router.post("/events")
def ingest_events(payload: BatchEventsRequest):
    from backend.services.event_logger import EventLogger
    event_dicts = [e.model_dump() if hasattr(e, "model_dump") else e.dict() for e in payload.events]
    default_uid = resolve_uid()
    for ed in event_dicts:
        if not ed.get("user_id"):
            ed["user_id"] = default_uid
    inserted = EventLogger.get_instance().log_events(event_dicts)
    return {"status": "ok", "inserted": inserted, "received": len(event_dicts)}

@router.get("/recommendations/deck/{request_id}")
def get_deck_replay(request_id: str):
    from backend.services.event_logger import EventLogger
    deck = EventLogger.get_instance().get_deck_by_request_id(request_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Request ID not found")
    return deck

@router.delete("/user/{user_id}/data")
def delete_user_telemetry_data(user_id: str):
    from backend.services.event_logger import EventLogger
    deleted = EventLogger.get_instance().delete_user_data(user_id)
    return {"status": "ok", "deleted_records": deleted, "user_id": user_id}

@router.get("/library")
def get_user_library(
    user_id: Optional[str] = Query(None), 
    limit: int = 60,
    mood: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    uid = resolve_uid(user_id)
    return GraphQueries.get_user_library(
        user_id=uid, 
        limit=limit,
        mood=mood,
        sort=sort,
        source=source,
        search=search
    )

from backend.services.ai_agent_service import AIAgentService

@router.post("/chat")
async def mood_chat(payload: ChatRequest):
    uid = resolve_uid(payload.user_id)
    return await AIAgentService.process_chat(
        user_id=uid,
        prompt=payload.prompt,
        history=payload.history or []
    )

@router.post("/vibe/image")
def visual_vibe_search(payload: ImageVibeRequest):
    uid = resolve_uid(payload.user_id)
    return GraphQueries.visual_vibe_search(
        user_id=uid,
        image_base64=payload.image_base64,
        mime_type=payload.mime_type,
        text_hint=payload.text_hint
    )

class LensHistoryItemRequest(BaseModel):
    user_id: Optional[str] = None
    title: str
    artist: str
    album: Optional[str] = ""
    thumbnail: Optional[str] = ""
    youtube_url: Optional[str] = ""
    spotify_url: Optional[str] = ""
    preview_url: Optional[str] = ""
    confidence: Optional[float] = 0.95
    mode: Optional[str] = "AUDIO"

def _record_lens_match_history(res: Dict[str, Any], user_id: str):
    """Auto-logs recognized tracks into SQLite 30-day lens history."""
    try:
        if not isinstance(res, dict):
            return
        status = res.get("status")
        if status in ("success", "candidates"):
            match_data = res.get("match") or res.get("top_match") or res
            title = match_data.get("title") or match_data.get("name") or res.get("detected_title") or "Unknown Title"
            artist = match_data.get("artist") or (match_data.get("artists")[0] if isinstance(match_data.get("artists"), list) and match_data.get("artists") else "") or res.get("detected_artist") or "Unknown Artist"
            thumb = match_data.get("thumbnail") or match_data.get("cover_url") or ""
            yt_url = match_data.get("youtube_url") or match_data.get("watch_url") or ""
            spot_url = match_data.get("spotify_url") or ""
            prev_url = match_data.get("preview_url") or yt_url
            conf = res.get("confidence") or match_data.get("confidence") or 0.95
            mode = res.get("mode") or "AUDIO"
            EventLogger.get_instance().log_lens_search(
                user_id=user_id,
                title=title,
                artist=artist,
                album=match_data.get("album", ""),
                thumbnail=thumb,
                youtube_url=yt_url,
                spotify_url=spot_url,
                preview_url=prev_url,
                confidence=conf,
                mode=mode
            )
    except Exception as e:
        logger.warning(f"Lens history auto-log failed: {e}")

@router.post("/vibe/identify-audio")
async def identify_audio_snippet(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    hint: Optional[str] = Form(None)
):
    uid = resolve_uid(user_id)
    audio_bytes = await file.read()
    mime_type = file.content_type or "audio/webm"
    result = await AcousticLensService.identify_audio(
        audio_bytes=audio_bytes,
        mime_type=mime_type,
        user_id=uid,
        text_hint=hint
    )
    _record_lens_match_history(result, uid)
    return result

@router.post("/vibe/identify-audio-base64")
async def identify_audio_base64(payload: AudioVibeRequest):
    uid = resolve_uid(payload.user_id)
    try:
        audio_bytes = base64.b64decode(payload.audio_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio data: {e}")
    result = await AcousticLensService.identify_audio(
        audio_bytes=audio_bytes,
        mime_type=payload.mime_type or "audio/m4a",
        user_id=uid,
        text_hint=payload.hint
    )
    _record_lens_match_history(result, uid)
    return result

@router.get("/vibe/history")
def get_vibe_history(user_id: Optional[str] = Query(None), days: int = Query(30)):
    """Retrieves lens search history for the user within the last 30 days."""
    uid = resolve_uid(user_id)
    return EventLogger.get_instance().get_lens_history(user_id=uid, days=days)

@router.post("/vibe/history")
def add_vibe_history(payload: LensHistoryItemRequest):
    """Manually records an audio search or match to the 30-day history."""
    uid = resolve_uid(payload.user_id)
    search_id = EventLogger.get_instance().log_lens_search(
        user_id=uid,
        title=payload.title,
        artist=payload.artist,
        album=payload.album or "",
        thumbnail=payload.thumbnail or "",
        youtube_url=payload.youtube_url or "",
        spotify_url=payload.spotify_url or "",
        preview_url=payload.preview_url or "",
        confidence=payload.confidence or 0.95,
        mode=payload.mode or "AUDIO"
    )
    return {"status": "success", "id": search_id}

@router.delete("/vibe/history")
def clear_vibe_history(user_id: Optional[str] = Query(None)):
    uid = resolve_uid(user_id)
    deleted = EventLogger.get_instance().clear_lens_history(user_id=uid)
    return {"status": "success", "deleted": deleted}

@router.get("/vibe/suggestions")
def get_vibe_suggestions(user_id: Optional[str] = Query(None)):
    uid = resolve_uid(user_id)
    return GraphQueries.get_dynamic_suggestions(user_id=uid)

@router.get("/recommendations/explain/{track_id:path}")
def explain_recommendation(track_id: str, user_id: Optional[str] = Query(None)):
    uid = resolve_uid(user_id)
    return GraphQueries.explain_recommendation(user_id=uid, track_id=track_id)

@router.get("/artists/top")
def get_top_artists(limit: int = 10):
    return GraphQueries.get_top_artists(limit=limit)

@router.get("/shortest-path")
def get_shortest_path(source: str = Query(...), target: str = Query(...)):
    return GraphQueries.find_shortest_path(source_artist=source, target_artist=target)
