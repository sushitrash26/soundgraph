from fastapi import APIRouter, Query, Body, UploadFile, File, Form
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from backend.graph.queries import GraphQueries
from backend.services.acoustic_lens import AcousticLensService

router = APIRouter(tags=["Recommendations & Analytics"])

class FeedbackRequest(BaseModel):
    user_id: str = "astitva_demo_user"
    track_id: str
    reward: float  # +1.0 for like, -1.0 for dislike

class ChatRequest(BaseModel):
    user_id: str = "astitva_demo_user"
    prompt: str
    history: Optional[List[Dict[str, Any]]] = None

class ImageVibeRequest(BaseModel):
    user_id: str = "astitva_demo_user"
    image_base64: str
    mime_type: str = "image/jpeg"
    text_hint: Optional[str] = None

class DwellTelemetryRequest(BaseModel):
    user_id: str = "astitva_demo_user"
    track_id: str
    arm: Optional[int] = 0
    dwell_ms: int
    explicit_action: Optional[float] = None
    session_depth: int = 1
    hour: Optional[int] = None

@router.get("/user/taste-profile")
def get_user_taste_profile(user_id: str = "astitva_demo_user"):
    return GraphQueries.get_user_taste_profile(user_id=user_id)

@router.get("/recommendations")
def get_recommendations(
    user_id: str = "astitva_demo_user", 
    limit: int = 15,
    exclude_ids: Optional[str] = Query(None, description="Comma-separated IDs already seen to enable infinite deck polling"),
    mood: Optional[str] = Query(None, description="Real-time mood filter: euphoric, melancholic, chill, high_energy")
):
    return GraphQueries.get_recommendations(
        user_id=user_id, 
        limit=limit,
        exclude_ids=exclude_ids,
        mood=mood
    )

@router.post("/recommendations/feedback")
def record_feedback(payload: FeedbackRequest):
    return GraphQueries.record_feedback(
        user_id=payload.user_id,
        track_id=payload.track_id,
        reward=payload.reward
    )

@router.post("/telemetry/dwell")
def record_dwell_telemetry(payload: DwellTelemetryRequest):
    return GraphQueries.record_dwell_telemetry(
        user_id=payload.user_id,
        track_id=payload.track_id,
        arm=payload.arm or 0,
        dwell_ms=payload.dwell_ms,
        explicit_action=payload.explicit_action,
        session_depth=payload.session_depth,
        hour=payload.hour
    )

@router.get("/library")
def get_user_library(
    user_id: str = "astitva_demo_user", 
    limit: int = 60,
    mood: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    return GraphQueries.get_user_library(
        user_id=user_id, 
        limit=limit,
        mood=mood,
        sort=sort,
        source=source,
        search=search
    )

from backend.services.ai_agent_service import AIAgentService

@router.post("/chat")
async def mood_chat(payload: ChatRequest):
    return await AIAgentService.process_chat(
        user_id=payload.user_id,
        prompt=payload.prompt,
        history=payload.history or []
    )

@router.post("/vibe/image")
def visual_vibe_search(payload: ImageVibeRequest):
    return GraphQueries.visual_vibe_search(
        user_id=payload.user_id,
        image_base64=payload.image_base64,
        mime_type=payload.mime_type,
        text_hint=payload.text_hint
    )

@router.post("/vibe/identify-audio")
async def identify_audio_snippet(
    file: UploadFile = File(...),
    user_id: str = Form("astitva_demo_user"),
    hint: Optional[str] = Form(None)
):
    audio_bytes = await file.read()
    mime_type = file.content_type or "audio/webm"
    return await AcousticLensService.identify_audio(
        audio_bytes=audio_bytes,
        mime_type=mime_type,
        user_id=user_id,
        text_hint=hint
    )

@router.get("/vibe/suggestions")
def get_vibe_suggestions(user_id: str = "astitva_demo_user"):
    return GraphQueries.get_dynamic_suggestions(user_id=user_id)

@router.get("/recommendations/explain/{track_id:path}")
def explain_recommendation(track_id: str, user_id: str = "astitva_demo_user"):
    return GraphQueries.explain_recommendation(user_id=user_id, track_id=track_id)

@router.get("/artists/top")
def get_top_artists(limit: int = 10):
    return GraphQueries.get_top_artists(limit=limit)

@router.get("/shortest-path")
def get_shortest_path(source: str = Query(...), target: str = Query(...)):
    return GraphQueries.find_shortest_path(source_artist=source, target_artist=target)
