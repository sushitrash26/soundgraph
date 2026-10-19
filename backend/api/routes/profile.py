from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Dict, Any
from backend.services.profile_service import ProfileService

router = APIRouter(prefix="/profile", tags=["User Profile & Passport"])

@router.get("/me")
async def get_my_profile(user_id: Optional[str] = Query(None)):
    """
    Returns the authenticated user's real-time Graph RAG profile and music passport:
    - On-the-fly Archetype & Tagline synthesized from their acoustic centroid
    - Top 4 most played artists with high-definition portraits cached from Deezer/iTunes
    - Graph RAG personalized duality sliders tailored to their acoustic duality
    - Dynamic Discovery Score (novelty, entropy, exploration velocity)
    - Live migration story (tracks moved, hours preserved, perfect transfers)
    - Achievement-based featured badge
    """
    try:
        profile_data = await ProfileService.get_user_profile(user_id=user_id)
        return profile_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate profile: {str(e)}")

@router.get("/passport/{user_id}")
async def get_public_passport(user_id: str):
    """
    Public shareable endpoint for rendering the Music Passport card for any user ID.
    Used by QR codes, web previews, and social share links.
    """
    try:
        profile_data = await ProfileService.get_user_profile(user_id=user_id)
        return {
            "status": "success",
            "passport": profile_data.get("passport"),
            "user": profile_data.get("user"),
            "top_artists": profile_data.get("top_artists"),
            "signature": profile_data.get("signature"),
            "featured_badge": profile_data.get("featured_badge")
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Music passport not found: {str(e)}")
