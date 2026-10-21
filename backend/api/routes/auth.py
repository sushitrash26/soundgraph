from fastapi import APIRouter, HTTPException, Query, Request, BackgroundTasks
from fastapi.responses import RedirectResponse, HTMLResponse
import urllib.parse
from backend.core.config import settings
from backend.core.logger import logger
from backend.graph.loader import GraphLoader
from backend.ingestors.spotify_ingestor import SpotifyIngestor
from backend.ingestors.google_youtube_ingestor import GoogleYouTubeIngestor

router = APIRouter(prefix="/auth", tags=["Authentication"])

from backend.core.cache import UnifiedCache
from backend.core.tokens import TokenManager

def _render_app_redirect_page(target_url: str, provider: str, error: str = None):
    decoded_target = urllib.parse.unquote(target_url)
    delimiter = "&" if "?" in decoded_target else "?"
    if error:
        final_url = f"{decoded_target}{delimiter}auth=error&msg={urllib.parse.quote(error)}"
    else:
        final_url = f"{decoded_target}{delimiter}auth=success&provider={provider}"

    return HTMLResponse(content=f"""<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SoundGraph • Login Successful</title>
    <style>
      body {{
        background: #0E0D0C;
        color: #FFFFFF;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        padding: 24px;
        text-align: center;
      }}
      .card {{
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: 24px;
        padding: 32px 24px;
        max-width: 340px;
        backdrop-filter: blur(20px);
      }}
      h2 {{ margin: 0 0 10px; font-weight: 800; font-size: 20px; }}
      p {{ color: rgba(255, 255, 255, 0.7); font-size: 13.5px; margin-bottom: 24px; line-height: 1.4; }}
      a.btn {{
        display: inline-block;
        background: #FFFFFF;
        color: #121212;
        padding: 13px 28px;
        border-radius: 9999px;
        text-decoration: none;
        font-weight: 700;
        font-size: 14.5px;
      }}
    </style>
  </head>
  <body>
    <div class="card">
      <h2>{"Connected to " + provider.title() if not error else "Authentication Note"}</h2>
      <p>{"Returning to SoundGraph mobile app..." if not error else error}</p>
      <a id="btn" class="btn" href="{final_url}">Open SoundGraph</a>
    </div>
    <script>
      setTimeout(function() {{
        window.location.href = "{final_url}";
      }}, 150);
    </script>
  </body>
</html>""")

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

def _resolve_redirect_uri(request: Request, provider: str) -> str:
    configured = getattr(settings, f"{provider.upper()}_REDIRECT_URI", "")
    # Check if request was forwarded via HTTPS reverse proxy (e.g. Cloud Run)
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if host and not ("127.0.0.1" in host or "localhost" in host):
        return f"{proto}://{host}/auth/{provider}/callback"
    if configured and not ("127.0.0.1" in configured or "localhost" in configured):
        return configured
    return configured or f"http://127.0.0.1:{settings.API_PORT}/auth/{provider}/callback"

@router.get("/spotify/login")
def spotify_login(request: Request, redirect: bool = True, return_to: str = Query(None)):
    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET:
        if redirect:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}/?error=spotify_credentials_missing")
        return {
            "status": "config_missing",
            "message": "Spotify API credentials not yet configured. Enter them in the settings modal.",
            "login_url": None
        }
    redirect_uri = _resolve_redirect_uri(request, "spotify")
    sp_oauth = SpotifyIngestor.get_oauth_manager(redirect_uri=redirect_uri)
    auth_url = sp_oauth.get_authorize_url(state=return_to if return_to else "web")
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
def spotify_callback(request: Request, code: str = Query(...), state: str = Query(None)):
    try:
        redirect_uri = _resolve_redirect_uri(request, "spotify")
        sp_oauth = SpotifyIngestor.get_oauth_manager(redirect_uri=redirect_uri)
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
        if state and (state.startswith("exp://") or state.startswith("soundgraph://") or "192.168." in state or "8081" in state):
            return _render_app_redirect_page(state, "spotify")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard?spotify_auth=success")
    except Exception as e:
        logger.error(f"Spotify callback error: {e}")
        if state and (state.startswith("exp://") or state.startswith("soundgraph://")):
            return _render_app_redirect_page(state, "spotify", error=str(e))
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard?spotify_auth=error&msg={str(e)}")

# --- Google / YouTube OAuth Endpoints ---

@router.get("/google/login")
def google_login(request: Request, redirect: bool = True, return_to: str = Query(None)):
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        if redirect:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}/?error=google_credentials_missing")
        return {
            "status": "config_missing",
            "message": "Google Client ID & Secret not configured in .env yet.",
            "login_url": None
        }
    redirect_uri = _resolve_redirect_uri(request, "google")
    auth_url = GoogleYouTubeIngestor.get_auth_url(redirect_uri=redirect_uri, state=return_to if return_to else "web")
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
async def google_callback(request: Request, code: str = Query(...), state: str = Query(None)):
    try:
        redirect_uri = _resolve_redirect_uri(request, "google")
        tokens = await GoogleYouTubeIngestor.exchange_code_for_token(code, redirect_uri=redirect_uri)
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
        if state and (state.startswith("exp://") or state.startswith("soundgraph://") or "192.168." in state or "8081" in state):
            return _render_app_redirect_page(state, "google")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard?google_auth=success")
    except Exception as e:
        logger.error(f"Google callback error: {e}")
        if state and (state.startswith("exp://") or state.startswith("soundgraph://")):
            return _render_app_redirect_page(state, "google", error=str(e))
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard?google_auth=error&msg={str(e)}")

@router.post("/google/exchange")
async def google_exchange(payload: dict):
    raw_input = payload.get("code") or payload.get("url") or ""
    raw_input = raw_input.strip()
    if not raw_input:
        raise HTTPException(status_code=400, detail="Authorization code or callback URL is required")

    code = raw_input
    if "code=" in raw_input:
        try:
            if "?" in raw_input:
                qs_str = raw_input.split("?", 1)[1]
            else:
                qs_str = raw_input
            qs = urllib.parse.parse_qs(qs_str)
            if "code" in qs:
                code = qs["code"][0]
        except Exception:
            pass

    try:
        tokens = await GoogleYouTubeIngestor.exchange_code_for_token(code)
        access_token = tokens["access_token"]
        refresh_token = tokens.get("refresh_token")
        SESSION_STORE["google_token"] = access_token

        ingestor = GoogleYouTubeIngestor(access_token=access_token)
        profile = await ingestor.fetch_user_profile()
        GraphLoader.upsert_user(profile)

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

        return {"status": "success", "user": SESSION_STORE["current_user"]}
    except Exception as e:
        logger.error(f"Google code exchange failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/spotify/exchange")
def spotify_exchange(payload: dict):
    raw_input = payload.get("code") or payload.get("url") or ""
    raw_input = raw_input.strip()
    if not raw_input:
        raise HTTPException(status_code=400, detail="Authorization code or callback URL is required")

    code = raw_input
    if "code=" in raw_input:
        try:
            if "?" in raw_input:
                qs_str = raw_input.split("?", 1)[1]
            else:
                qs_str = raw_input
            qs = urllib.parse.parse_qs(qs_str)
            if "code" in qs:
                code = qs["code"][0]
        except Exception:
            pass

    try:
        sp_oauth = SpotifyIngestor.get_oauth_manager()
        token_info = sp_oauth.get_access_token(code)
        access_token = token_info["access_token"]
        refresh_token = token_info.get("refresh_token")
        SESSION_STORE["spotify_token"] = access_token

        sp_ingestor = SpotifyIngestor(auth_token=access_token)
        profile = sp_ingestor.fetch_user_profile()
        GraphLoader.upsert_user(profile)

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

        return {"status": "success", "user": SESSION_STORE["current_user"]}
    except Exception as e:
        logger.error(f"Spotify code exchange failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/trigger-pc-login")
def trigger_pc_login(payload: dict = None):
    provider = "google"
    if payload and isinstance(payload, dict):
        provider = payload.get("provider", "google")
    import webbrowser
    login_url = f"http://127.0.0.1:{settings.API_PORT}/auth/{provider}/login?redirect=true"
    try:
        webbrowser.open(login_url)
        return {"status": "opened", "url": login_url}
    except Exception as e:
        logger.warning(f"Failed to open browser on PC: {e}")
        return {"status": "error", "message": str(e), "url": login_url}


@router.post("/guest-login")
def guest_login():
    """Sets demo user session for instant exploration"""
    SESSION_STORE["current_user"] = {
        "id": "demo_guest_user",
        "name": "Guest Explorer",
        "avatar_url": "",
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
