from typing import Optional, List
from pydantic import BaseModel, Field

class Artist(BaseModel):
    id: str
    name: str
    genres: List[str] = Field(default_factory=list)
    popularity: Optional[int] = None
    source: str = "spotify"
    pagerank: Optional[float] = None

class Genre(BaseModel):
    name: str
    track_count: Optional[int] = 0
    community_id: Optional[int] = None
