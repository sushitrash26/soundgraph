import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Locate .env in project root or current directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

class Settings(BaseSettings):
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "soundgraph123"
    NEO4J_DATABASE: str = "neo4j"

    SPOTIFY_CLIENT_ID: str = ""
    SPOTIFY_CLIENT_SECRET: str = ""
    SPOTIFY_REDIRECT_URI: str = "http://127.0.0.1:8001/auth/spotify/callback"

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://127.0.0.1:8001/auth/google/callback"

    FRONTEND_URL: str = "http://localhost:5173"
    API_PORT: int = 8001
    API_HOST: str = "0.0.0.0"

    GEMINI_API_KEY: str = ""

    class Config:
        env_file = str(ENV_FILE) if ENV_FILE.exists() else ".env"
        extra = "ignore"

settings = Settings()
