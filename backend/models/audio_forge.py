from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class DetectedStem(BaseModel):
    stem_id: str
    instrument: str
    role: str = "lead"
    demucs_source: str = "other"  # vocals, drums, bass, guitar, piano, other
    description: str = ""
    frequency_focus: str = ""
    file_path: Optional[str] = None
    duration_sec: float = 0.0
    rms_energy: float = 0.0

class AudioStemManifest(BaseModel):
    song_title: str = "Untitled Track"
    bpm: int = 120
    musical_key: str = "C Major"
    energy_score: float = 0.5
    valence_score: float = 0.5
    acousticness_score: float = 0.5
    genre_classification: List[str] = Field(default_factory=list)
    emotional_profile: str = "balanced"
    detected_instruments: List[DetectedStem] = Field(default_factory=list)
    job_id: Optional[str] = None

class StemSeparationJob(BaseModel):
    job_id: str
    status: str = "pending"  # pending, analyzing, separating, completed, failed
    progress_percent: int = 0
    song_title: str = ""
    source_file: str = ""
    manifest: Optional[AudioStemManifest] = None
    stems: List[DetectedStem] = Field(default_factory=list)
    error_message: Optional[str] = None
    created_at: float = 0.0
    completed_at: Optional[float] = None

class StemTransformRequest(BaseModel):
    stem_id: str
    mode: str = "taste"  # "taste" or "prompt"
    user_id: Optional[str] = None
    prompt: Optional[str] = None  # e.g., "acoustic to electric guitar with subtle tape delay"

class StemTransformResponse(BaseModel):
    original_stem_id: str
    transformed_stem_id: str
    transformed_file_url: str
    applied_parameters: Dict[str, Any] = Field(default_factory=dict)
    description: str = ""

class RemixStemTrack(BaseModel):
    stem_id: str
    volume_db: float = 0.0
    pan: float = 0.0  # -1.0 (left) to 1.0 (right)
    is_muted: bool = False
    is_solo: bool = False

class RemixExportRequest(BaseModel):
    job_id: str
    user_id: Optional[str] = None
    remix_title: str = "Remix Master"
    stems: List[RemixStemTrack] = Field(default_factory=list)
    master_gain_db: float = 0.0
    output_format: str = "mp3"  # mp3 or wav

class RemixExportResponse(BaseModel):
    remix_id: str
    title: str
    file_url: str
    duration_sec: float
    integrated_lufs: float = -14.0
    stems_used_count: int
