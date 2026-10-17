from typing import Optional, List
from pydantic import BaseModel, Field

class AudioFeatures(BaseModel):
    energy: Optional[float] = None
    valence: Optional[float] = None
    danceability: Optional[float] = None
    tempo: Optional[float] = None
    acousticness: Optional[float] = None
    instrumentalness: Optional[float] = None

class Track(BaseModel):
    id: str
    name: str
    artists: List[str] = Field(default_factory=list)
    album: Optional[str] = None
    genres: List[str] = Field(default_factory=list)
    source: str = "spotify"  # "spotify" | "youtube"
    uri: Optional[str] = None
    duration_ms: Optional[int] = None
    popularity: Optional[int] = None
    play_count: Optional[int] = 1
    cover_url: Optional[str] = None
    embedding: Optional[List[float]] = None
    features: Optional[AudioFeatures] = None
