from fastapi import APIRouter, Query, Body, UploadFile, File, Form, HTTPException
import base64
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from backend.graph.queries import GraphQueries
from backend.services.acoustic_lens import AcousticLensService
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
    return GraphQueries.record_feedback(
        user_id=uid,
        track_id=payload.track_id,
        reward=payload.reward
    )

@router.post("/telemetry/dwell")
def record_dwell_telemetry(payload: DwellTelemetryRequest):
    uid = resolve_uid(payload.user_id)
    return GraphQueries.record_dwell_telemetry(
        user_id=uid,
        track_id=payload.track_id,
        arm=payload.arm or 0,
        dwell_ms=payload.dwell_ms,
        explicit_action=payload.explicit_action,
        session_depth=payload.session_depth,
        hour=payload.hour
    )

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

@router.post("/vibe/identify-audio")
async def identify_audio_snippet(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    hint: Optional[str] = Form(None)
):
    uid = resolve_uid(user_id)
    audio_bytes = await file.read()
    mime_type = file.content_type or "audio/webm"
    return await AcousticLensService.identify_audio(
        audio_bytes=audio_bytes,
        mime_type=mime_type,
        user_id=uid,
        text_hint=hint
    )

@router.post("/vibe/identify-audio-base64")
async def identify_audio_base64(payload: AudioVibeRequest):
    uid = resolve_uid(payload.user_id)
    try:
        audio_bytes = base64.b64decode(payload.audio_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio data: {e}")
    return await AcousticLensService.identify_audio(
        audio_bytes=audio_bytes,
        mime_type=payload.mime_type or "audio/m4a",
        user_id=uid,
        text_hint=payload.hint
    )

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
