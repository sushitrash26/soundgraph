from fastapi import APIRouter, Query, HTTPException, Body
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from backend.services.deck_service import DeckService
from backend.api.routes.auth import SESSION_STORE

router = APIRouter(prefix="/decks", tags=["Personalized Decks"])

def resolve_uid(user_id: Optional[str] = None) -> str:
    """Dynamically resolves the active user ID from request or session store."""
    if user_id and user_id.strip():
        return user_id.strip()
    session_user = SESSION_STORE.get("current_user")
    if session_user and session_user.get("id"):
        return session_user["id"]
    return ""

class CreateDeckRequest(BaseModel):
    user_id: Optional[str] = None
    name: str
    mood: Optional[str] = "general"
    track_ids: Optional[List[str]] = []
    cover_url: Optional[str] = ""

class AddTrackRequest(BaseModel):
    track_id: str

@router.get("")
def list_decks(user_id: Optional[str] = Query(None)):
    uid = resolve_uid(user_id)
    return DeckService.list_user_decks(user_id=uid)

@router.post("")
def create_deck(payload: CreateDeckRequest):
    uid = resolve_uid(payload.user_id)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required to create a deck.")
    return DeckService.create_deck(
        user_id=uid,
        name=payload.name,
        mood=payload.mood or "general",
        track_ids=payload.track_ids or [],
        cover_url=payload.cover_url or ""
    )

@router.get("/{deck_id}")
def get_deck_cards(deck_id: str, user_id: Optional[str] = Query(None)):
    uid = resolve_uid(user_id)
    deck = DeckService.get_deck_cards(deck_id=deck_id, user_id=uid)
    if not deck or not deck.get("cards"):
        return deck
    return deck

@router.post("/{deck_id}/tracks")
def add_track_to_deck(deck_id: str, payload: AddTrackRequest):
    success = DeckService.add_track_to_deck(deck_id=deck_id, track_id=payload.track_id)
    if not success:
        raise HTTPException(status_code=400, detail="Could not add track to deck.")
    return {"status": "success", "message": "Track added to deck."}

@router.delete("/{deck_id}/tracks/{track_id:path}")
def remove_track_from_deck(deck_id: str, track_id: str):
    success = DeckService.remove_track_from_deck(deck_id=deck_id, track_id=track_id)
    return {"status": "success", "removed": success}

@router.delete("/{deck_id}")
def delete_deck(deck_id: str, user_id: Optional[str] = Query(None)):
    uid = resolve_uid(user_id)
    success = DeckService.delete_deck(deck_id=deck_id, user_id=uid)
    return {"status": "success", "deleted": success}
