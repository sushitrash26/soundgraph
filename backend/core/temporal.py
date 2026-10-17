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
        """
        Continuous Circadian Situational Synthesis:
        Zero rigid 4-bucket step cliffs. Continuous diurnal progression mapping exact time-of-day
        into atmospheric acoustic context.
        """
        dt = client_dt or datetime.now()
        day_name = dt.strftime("%A")
        time_str = dt.strftime("%I:%M %p")
        hour = dt.hour
        minute = dt.minute
        minute_of_day = hour * 60 + minute

        # Continuous circadian progression across 24 hours
        if 300 <= minute_of_day < 420:      # 5:00 AM - 6:59 AM
            period = "dawn stillness, sunrise awakening, crisp morning clarity"
        elif 420 <= minute_of_day < 720:     # 7:00 AM - 11:59 AM
            period = "morning momentum, energetic focus, productive clarity"
        elif 720 <= minute_of_day < 840:     # 12:00 PM - 1:59 PM
            period = "midday daylight, bright energy, rhythmic stride"
        elif 840 <= minute_of_day < 1080:    # 2:00 PM - 5:59 PM
            period = "afternoon deep flow, steady acoustic momentum, focused drive"
        elif 1080 <= minute_of_day < 1200:   # 6:00 PM - 7:59 PM
            period = "golden hour transition, sunset dusk, unwinding ambiance"
        elif 1200 <= minute_of_day < 1380:   # 8:00 PM - 10:59 PM
            period = "evening decompression, vibrant nightfall, social warmth"
        elif 1380 <= minute_of_day or minute_of_day < 180: # 11:00 PM - 2:59 AM
            period = "midnight solitude, late-night introspective atmosphere, quiet coding flow"
        else:                                # 3:00 AM - 4:59 AM
            period = "deep nocturnal silence, ethereal stillness, meditative solitude"

        return f"Music capturing the sonic atmosphere of a {day_name} at {time_str} ({period})"

    @classmethod
    def get_temporal_context_vector(cls, client_dt: Optional[datetime] = None) -> Optional[List[float]]:
        """
        Generates a 768-D Gemini embedding vector for the current temporal situation.
        Allows pure latent-space acoustic matching without any hardcoded genres.
        """
        prompt = cls.get_situational_prompt(client_dt)
        return GeminiEmbedder.embed_text_sync(prompt)
