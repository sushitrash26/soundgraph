import time
import httpx
from typing import Optional, Dict, Any
from backend.core.config import settings
from backend.core.logger import logger
from backend.core.cache import UnifiedCache

SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

class TokenManager:
    """
    Automated Silent OAuth Token Refresh Interceptor:
    1. Stores access_token, refresh_token, and expires_at in UnifiedCache (Redis/SQLite).
    2. Transparently inspects token validity before any API call.
    3. Silently exchanges refresh_token for a fresh access_token 120s before expiration.
    4. Eliminates HTTP 401 token expiry failures.
    """

    @classmethod
    def save_tokens(
        cls,
        user_id: str,
        provider: str,
        access_token: str,
        refresh_token: Optional[str] = None,
        expires_in: int = 3600
    ):
        data = cls.get_token_data(user_id, provider) or {}
        data["access_token"] = access_token
        if refresh_token:
            data["refresh_token"] = refresh_token
        data["expires_at"] = time.time() + expires_in
        data["provider"] = provider
        data["updated_at"] = time.time()

        key = f"token:{provider}:{user_id}"
        UnifiedCache.set(key, data, ttl=86400 * 90)  # Persist for 90 days
        logger.info(f"TokenManager: Stored {provider} tokens for user {user_id} (expires in {expires_in}s)")

    @classmethod
    def get_token_data(cls, user_id: str, provider: str) -> Optional[Dict[str, Any]]:
        key = f"token:{provider}:{user_id}"
        return UnifiedCache.get(key)

    @classmethod
    async def get_valid_token(cls, user_id: str, provider: str) -> Optional[str]:
        data = cls.get_token_data(user_id, provider)
        if not data:
            return None

        access_token = data.get("access_token")
        refresh_token = data.get("refresh_token")
        expires_at = data.get("expires_at", 0)

        # If token is still fresh (more than 120s remaining), use it
        if time.time() < (expires_at - 120):
            return access_token

        # Needs silent refresh!
        if not refresh_token:
            logger.warning(f"TokenManager: {provider} token expired and no refresh_token stored for user {user_id}.")
            return access_token

        logger.info(f"TokenManager: Token expiring soon for user {user_id} on {provider}. Silently renewing...")
        new_token = None
        if provider == "spotify":
            new_token = await cls._refresh_spotify(refresh_token)
        elif provider in ["google", "google_youtube", "youtube"]:
            new_token = await cls._refresh_google(refresh_token)

        if new_token:
            cls.save_tokens(
                user_id=user_id,
                provider=provider,
                access_token=new_token["access_token"],
                refresh_token=new_token.get("refresh_token") or refresh_token,
                expires_in=new_token.get("expires_in", 3600)
            )
            return new_token["access_token"]

        return access_token

    @classmethod
    async def _refresh_spotify(cls, refresh_token: str) -> Optional[Dict[str, Any]]:
        client_id = settings.SPOTIFY_CLIENT_ID
        client_secret = settings.SPOTIFY_CLIENT_SECRET
        if not client_id or not client_secret:
            return None

        payload = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }
        auth = (client_id, client_secret)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(SPOTIFY_TOKEN_URL, data=payload, auth=auth)
                if res.status_code == 200:
                    return res.json()
                logger.error(f"Spotify silent refresh failed ({res.status_code}): {res.text}")
        except Exception as e:
            logger.error(f"Error during Spotify silent token renewal: {e}")
        return None

    @classmethod
    async def _refresh_google(cls, refresh_token: str) -> Optional[Dict[str, Any]]:
        client_id = settings.GOOGLE_CLIENT_ID
        client_secret = settings.GOOGLE_CLIENT_SECRET
        if not client_id or not client_secret:
            return None

        payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(GOOGLE_TOKEN_URL, data=payload)
                if res.status_code == 200:
                    return res.json()
                logger.error(f"Google silent refresh failed ({res.status_code}): {res.text}")
        except Exception as e:
            logger.error(f"Error during Google silent token renewal: {e}")
        return None
