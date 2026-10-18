from fastapi import APIRouter, Query, HTTPException, Body
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from backend.services.deck_service import DeckService

router = APIRouter(prefix="/decks", tags=["Personalized Decks"])

class CreateDeckRequest(BaseModel):
    user_id: str = "astitva_demo_user"
    name: str
    mood: Optional[str] = "general"
    track_ids: Optional[List[str]] = []
    cover_url: Optional[str] = ""

class AddTrackRequest(BaseModel):
    track_id: str

@router.get("")
def list_decks(user_id: str = Query("astitva_demo_user")):
    return DeckService.list_user_decks(user_id=user_id)

@router.post("")
def create_deck(payload: CreateDeckRequest):
    return DeckService.create_deck(
        user_id=payload.user_id,
        name=payload.name,
        mood=payload.mood or "general",
        track_ids=payload.track_ids or [],
        cover_url=payload.cover_url or ""
    )

@router.get("/{deck_id}")
def get_deck_cards(deck_id: str, user_id: str = Query("astitva_demo_user")):
    deck = DeckService.get_deck_cards(deck_id=deck_id, user_id=user_id)
    if not deck or not deck.get("cards"):
        # return empty deck payload gracefully
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
def delete_deck(deck_id: str, user_id: str = Query("astitva_demo_user")):
    success = DeckService.delete_deck(deck_id=deck_id, user_id=user_id)
    return {"status": "success", "deleted": success}
