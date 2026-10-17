from fastapi import APIRouter, Query, Body
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from backend.graph.queries import GraphQueries

router = APIRouter(tags=["Recommendations & Analytics"])

class FeedbackRequest(BaseModel):
    user_id: str = "astitva_demo_user"
    track_id: str
    reward: float  # +1.0 for like, -1.0 for dislike

class ChatRequest(BaseModel):
    user_id: str = "astitva_demo_user"
    prompt: str

@router.get("/recommendations")
def get_recommendations(user_id: str = "astitva_demo_user", limit: int = 15):
    return GraphQueries.get_recommendations(user_id=user_id, limit=limit)

@router.post("/recommendations/feedback")
def record_feedback(payload: FeedbackRequest):
    return GraphQueries.record_feedback(
        user_id=payload.user_id,
        track_id=payload.track_id,
        reward=payload.reward
    )

@router.get("/library")
def get_user_library(user_id: str = "astitva_demo_user", limit: int = 50):
    return GraphQueries.get_user_library(user_id=user_id, limit=limit)

@router.post("/chat")
def mood_chat(payload: ChatRequest):
    return GraphQueries.mood_chat(user_id=payload.user_id, prompt=payload.prompt)

@router.get("/recommendations/explain/{track_id:path}")
def explain_recommendation(track_id: str, user_id: str = "astitva_demo_user"):
    return GraphQueries.explain_recommendation(user_id=user_id, track_id=track_id)

@router.get("/artists/top")
def get_top_artists(limit: int = 10):
    return GraphQueries.get_top_artists(limit=limit)

@router.get("/shortest-path")
def get_shortest_path(source: str = Query(...), target: str = Query(...)):
    return GraphQueries.find_shortest_path(source_artist=source, target_artist=target)
