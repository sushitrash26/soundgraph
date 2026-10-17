from fastapi import APIRouter, HTTPException, Query, Request, BackgroundTasks
from fastapi.responses import RedirectResponse
from backend.core.config import settings
from backend.core.logger import logger
from backend.graph.loader import GraphLoader
from backend.ingestors.spotify_ingestor import SpotifyIngestor
from backend.ingestors.google_youtube_ingestor import GoogleYouTubeIngestor

router = APIRouter(prefix="/auth", tags=["Authentication"])

from backend.core.cache import UnifiedCache
from backend.core.tokens import TokenManager

# Backward-compatible proxy for in-memory access backed by UnifiedCache
class PersistentSessionStore:
    def __getitem__(self, key):
        return UnifiedCache.get(f"session:{key}")

    def __setitem__(self, key, value):
        UnifiedCache.set(f"session:{key}", value, ttl=86400 * 30)

    def get(self, key, default=None):
        val = UnifiedCache.get(f"session:{key}")
        return val if val is not None else default

SESSION_STORE = PersistentSessionStore()

@router.get("/spotify/login")
def spotify_login(redirect: bool = True):
    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET:
        if redirect:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}/?error=spotify_credentials_missing")
        return {
            "status": "config_missing",
            "message": "Spotify API credentials not yet configured. Enter them in the settings modal.",
            "login_url": None
        }
    sp_oauth = SpotifyIngestor.get_oauth_manager()
    auth_url = sp_oauth.get_authorize_url()
    if redirect:
        return RedirectResponse(url=auth_url)
    return {"status": "ready", "login_url": auth_url}

@router.post("/spotify/credentials")
async def set_spotify_credentials(request: Request):
    data = await request.json()
    client_id = data.get("client_id", "").strip()
    client_secret = data.get("client_secret", "").strip()
    if not client_id or not client_secret:
        raise HTTPException(status_code=400, detail="Both client_id and client_secret are required.")

    settings.SPOTIFY_CLIENT_ID = client_id
    settings.SPOTIFY_CLIENT_SECRET = client_secret

    # Persist into .env
    try:
        from pathlib import Path
        env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
        if env_path.exists():
            content = env_path.read_text()
            lines = []
            for line in content.splitlines():
                if line.startswith("SPOTIFY_CLIENT_ID="):
                    lines.append(f"SPOTIFY_CLIENT_ID={client_id}")
                elif line.startswith("SPOTIFY_CLIENT_SECRET="):
                    lines.append(f"SPOTIFY_CLIENT_SECRET={client_secret}")
                else:
                    lines.append(line)
            env_path.write_text("\n".join(lines) + "\n")
    except Exception as e:
        logger.warning(f"Failed to persist credentials to .env: {e}")

    sp_oauth = SpotifyIngestor.get_oauth_manager()
    auth_url = sp_oauth.get_authorize_url()
    return {"status": "success", "login_url": auth_url}

@router.get("/spotify/callback")
def spotify_callback(code: str = Query(...)):
    try:
        sp_oauth = SpotifyIngestor.get_oauth_manager()
        token_info = sp_oauth.get_access_token(code)
        access_token = token_info["access_token"]
        refresh_token = token_info.get("refresh_token")
        SESSION_STORE["spotify_token"] = access_token

        # Fetch Spotify profile
        sp_ingestor = SpotifyIngestor(auth_token=access_token)
        profile = sp_ingestor.fetch_user_profile()
        GraphLoader.upsert_user(profile)

        # Save tokens with automatic silent refresh
        TokenManager.save_tokens(
            user_id=profile["id"],
            provider="spotify",
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=token_info.get("expires_in", 3600)
        )

        SESSION_STORE["current_user"] = {
            "id": profile["id"],
            "name": profile["name"],
            "avatar_url": profile["avatar_url"],
            "primary_source": "spotify",
        }
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard?spotify_auth=success")
    except Exception as e:
        logger.error(f"Spotify callback error: {e}")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard?spotify_auth=error&msg={str(e)}")

# --- Google / YouTube OAuth Endpoints ---

@router.get("/google/login")
def google_login(redirect: bool = True):
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        if redirect:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}/?error=google_credentials_missing")
        return {
            "status": "config_missing",
            "message": "Google Client ID & Secret not configured in .env yet.",
            "login_url": None
        }
    auth_url = GoogleYouTubeIngestor.get_auth_url()
    if redirect:
        return RedirectResponse(url=auth_url)
    return {"status": "ready", "login_url": auth_url}

@router.post("/google/credentials")
async def set_google_credentials(request: Request):
    data = await request.json()
    client_id = data.get("client_id", "").strip()
    client_secret = data.get("client_secret", "").strip()
    if not client_id or not client_secret:
        raise HTTPException(status_code=400, detail="Both client_id and client_secret are required.")

    settings.GOOGLE_CLIENT_ID = client_id
    settings.GOOGLE_CLIENT_SECRET = client_secret

    try:
        from pathlib import Path
        env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
        if env_path.exists():
            content = env_path.read_text()
            lines = [l for l in content.splitlines() if not l.startswith("GOOGLE_CLIENT_ID=") and not l.startswith("GOOGLE_CLIENT_SECRET=")]
            lines.append(f"GOOGLE_CLIENT_ID={client_id}")
            lines.append(f"GOOGLE_CLIENT_SECRET={client_secret}")
            env_path.write_text("\n".join(lines) + "\n")
    except Exception as e:
        logger.warning(f"Failed to persist Google creds to .env: {e}")

    auth_url = GoogleYouTubeIngestor.get_auth_url()
    return {"status": "success", "login_url": auth_url}

@router.get("/google/callback")
async def google_callback(code: str = Query(...)):
    try:
        tokens = await GoogleYouTubeIngestor.exchange_code_for_token(code)
        access_token = tokens["access_token"]
        refresh_token = tokens.get("refresh_token")
        SESSION_STORE["google_token"] = access_token

        # Fetch Google profile
        ingestor = GoogleYouTubeIngestor(access_token=access_token)
        profile = await ingestor.fetch_user_profile()
        GraphLoader.upsert_user(profile)

        # Save tokens with automatic silent refresh
        TokenManager.save_tokens(
            user_id=profile["id"],
            provider="google",
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=tokens.get("expires_in", 3600)
        )

        SESSION_STORE["current_user"] = {
            "id": profile["id"],
            "name": profile["name"],
            "avatar_url": profile["avatar_url"],
            "primary_source": "google_youtube",
        }
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard?google_auth=success")
    except Exception as e:
        logger.error(f"Google callback error: {e}")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard?google_auth=error&msg={str(e)}")

@router.post("/guest-login")
def guest_login():
    """Sets demo user session for instant exploration"""
    SESSION_STORE["current_user"] = {
        "id": "astitva_demo_user",
        "name": "Astitva Pathak",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "primary_source": "unified_taste_graph",
    }
    return {"status": "success", "user": SESSION_STORE["current_user"]}

@router.get("/me")
def get_current_user():
    return {
        "user": SESSION_STORE.get("current_user"),
        "spotify_connected": bool(SESSION_STORE.get("spotify_token")),
        "google_connected": bool(SESSION_STORE.get("google_token")),
        "has_spotify_keys": bool(settings.SPOTIFY_CLIENT_ID and settings.SPOTIFY_CLIENT_SECRET),
        "has_google_keys": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET),
    }

@router.post("/logout")
def logout():
    UnifiedCache.delete("session:current_user")
    UnifiedCache.delete("session:spotify_token")
    UnifiedCache.delete("session:google_token")
    return {"status": "logged_out"}
