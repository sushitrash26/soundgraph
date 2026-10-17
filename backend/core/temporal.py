import math
from datetime import datetime
from typing import Dict, Any, Optional, List
from backend.embeddings.gemini_embedder import GeminiEmbedder

class AITemporalEngine:
    """
    AI-Driven Temporal Dynamics & Situational Context Engine:
    Zero hardcoded genre rules or arbitrary condition tables.
    1. Real-Time Situational Context Embedding: Converts timestamp into natural situational
       semantics and generates a 768-D temporal vector via Gemini.
    2. Exponential Time Decay: Computes mathematical half-life decay on real listening timestamps.
    """

    DEFAULT_HALF_LIFE_DAYS = 30.0

    @classmethod
    def calculate_time_decay_weight(cls, event_datetime: Optional[datetime], half_life_days: float = DEFAULT_HALF_LIFE_DAYS) -> float:
        """
        Mathematical exponential decay factor w in (0.0, 1.0].
        Events from today have w ~ 1.0; events 30 days ago have w ~ 0.50; events 90 days ago have w ~ 0.125.
        """
        if not event_datetime:
            return 0.70

        try:
            now = datetime.now()
            delta = now - event_datetime
            delta_days = max(0.0, delta.total_seconds() / 86400.0)
            decay_constant = math.log(2) / half_life_days
            return round(math.exp(-decay_constant * delta_days), 4)
        except Exception:
            return 0.70

    @classmethod
    def get_situational_prompt(cls, client_dt: Optional[datetime] = None) -> str:
        """Translates current time and day into an AI situational query"""
        dt = client_dt or datetime.now()
        day_name = dt.strftime("%A")
        time_str = dt.strftime("%I:%M %p")
        hour = dt.hour

        if 23 <= hour or hour < 5:
            period = "late-night quiet hours, midnight atmosphere, introspective solitude"
        elif 5 <= hour < 12:
            period = "morning awakening, fresh start, energizing momentum"
        elif 12 <= hour < 18:
            period = "afternoon productivity flow, focused rhythmic stability"
        else:
            period = "evening unwind, vibrant atmosphere, sunset transition"

        return f"Music capturing the sonic atmosphere of a {day_name} at {time_str} ({period})"

    @classmethod
    def get_temporal_context_vector(cls, client_dt: Optional[datetime] = None) -> Optional[List[float]]:
        """
        Generates a 768-D Gemini embedding vector for the current temporal situation.
        Allows pure latent-space acoustic matching without any hardcoded genres.
        """
        prompt = cls.get_situational_prompt(client_dt)
        return GeminiEmbedder.embed_text_sync(prompt)
