from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class RecommendationItem(BaseModel):
    track_id: str
    track_name: str
    artists: List[str]
    source: str
    score: float
    reason: str
    genres: List[str] = Field(default_factory=list)
    cover_url: Optional[str] = None
    transition_flow: Optional[str] = None
    energy: Optional[float] = None
    valence: Optional[float] = None
    danceability: Optional[float] = None

class ExplanationPath(BaseModel):
    source_track: str
    target_track: str
    shared_artists: List[str] = Field(default_factory=list)
    shared_genres: List[str] = Field(default_factory=list)
    similarity_score: float = 0.0
    path_nodes: List[Dict[str, Any]] = Field(default_factory=list)
    explanation: str

class GraphStats(BaseModel):
    users_count: int = 0
    tracks_count: int = 0
    artists_count: int = 0
    genres_count: int = 0
    similar_to_edges_count: int = 0
    listened_to_edges_count: int = 0
    communities_count: int = 0
