from typing import Dict, Any, Optional, Tuple
from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger

class TasteStyler:
    """
    Phase 4A: Neo4j Knowledge Graph Taste Centroid Derivation.
    Extracts the user's acoustic DNA from their listening graph and translates
    the acoustic differential into exact deterministic DSP parameters.
    """

    @classmethod
    def get_user_taste_centroid(cls, user_id: str) -> Dict[str, Any]:
        """Queries Neo4j for user's aggregate listening preferences."""
        default_centroid = {
            "energy": 0.55,
            "valence": 0.50,
            "acousticness": 0.40,
            "danceability": 0.55,
            "top_genres": ["Indie", "Electronic", "Rock"],
            "top_artists": ["Tame Impala", "Radiohead", "Bonobo"]
        }
        
        try:
            q = """
            MATCH (u:User {id: $user_id})
            OPTIONAL MATCH (u)-[r:LISTENED_TO]->(t:Track)
            OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
            OPTIONAL MATCH (t)-[:BY]->(a:Artist)
            WITH u,
                 avg(coalesce(t.energy, 0.55)) AS avg_energy,
                 avg(coalesce(t.valence, 0.50)) AS avg_valence,
                 avg(coalesce(t.acousticness, 0.40)) AS avg_acousticness,
                 avg(coalesce(t.danceability, 0.55)) AS avg_danceability,
                 collect(DISTINCT g.name)[0..5] AS genres,
                 collect(DISTINCT a.name)[0..5] AS artists
            RETURN avg_energy, avg_valence, avg_acousticness, avg_danceability, genres, artists
            """
            rows = neo4j_conn.query(q, {"user_id": user_id})
            if rows and rows[0].get("avg_energy") is not None:
                r = rows[0]
                return {
                    "energy": round(float(r["avg_energy"] or 0.55), 2),
                    "valence": round(float(r["avg_valence"] or 0.50), 2),
                    "acousticness": round(float(r["avg_acousticness"] or 0.40), 2),
                    "danceability": round(float(r["avg_danceability"] or 0.55), 2),
                    "top_genres": r["genres"] if r.get("genres") else default_centroid["top_genres"],
                    "top_artists": r["artists"] if r.get("artists") else default_centroid["top_artists"]
                }
        except Exception as e:
            logger.warning(f"TasteStyler: Failed to query Neo4j for user {user_id}: {e}")

        return default_centroid

    @classmethod
    def derive_dsp_parameters_from_taste(
        cls,
        user_id: str,
        instrument: str,
        stem_energy: float = 0.5
    ) -> Tuple[Dict[str, Any], str]:
        """
        Calculates acoustic delta between stem and user taste centroid,
        yielding deterministic DSP parameters and an editorial explanation.
        """
        taste = cls.get_user_taste_centroid(user_id)
        delta_acoustic = taste["acousticness"] - 0.40
        delta_energy = taste["energy"] - stem_energy
        delta_valence = taste["valence"] - 0.50

        # Base parameters
        dsp_params = {
            "pitch_shift_semitones": 0,
            "lowpass_cutoff_hz": 0,       # 0 = bypass
            "highshelf_gain_db": 0.0,
            "saturation_gain_db": 0.0,
            "reverb_wet": 0.15,
            "delay_time_ms": 0,
            "transient_attack_boost": 0.0
        }

        explanations = []

        # 1. Warmth & Acousticness steering
        if delta_acoustic > 0.15:
            dsp_params["lowpass_cutoff_hz"] = 4800
            dsp_params["reverb_wet"] = 0.35
            dsp_params["saturation_gain_db"] = 2.0
            explanations.append(f"Warmed timbre with analog tape saturation (+2dB) and plate reverb (35% wet) matching your {taste['acousticness']:.0%} acoustic preference.")
        elif delta_acoustic < -0.15:
            dsp_params["highshelf_gain_db"] = 3.5
            dsp_params["saturation_gain_db"] = 4.0
            explanations.append("Brightened upper presence (+3.5dB at 8kHz) with modern harmonics to match your electronic/production preference.")

        # 2. Energy steering
        if delta_energy > 0.15:
            dsp_params["saturation_gain_db"] += 3.0
            dsp_params["transient_attack_boost"] = 0.3
            explanations.append(f"Sharpened transient attack (+30%) and drove harmonic presence for a higher-energy delivery ({taste['energy']:.0%} target).")
        elif delta_energy < -0.15:
            dsp_params["reverb_wet"] = min(0.6, dsp_params["reverb_wet"] + 0.2)
            dsp_params["lowpass_cutoff_hz"] = 3600
            explanations.append("Smoothed dynamics and deepened spatial ambiance for a relaxed, atmospheric contour.")

        # 3. Valence (Emotional Brightness) steering
        if delta_valence < -0.20:
            dsp_params["pitch_shift_semitones"] = -1
            explanations.append("Detuned by -1 semitone to introduce deeper nocturnal melancholia matching your listening habits.")
        elif delta_valence > 0.20:
            dsp_params["highshelf_gain_db"] += 1.5
            explanations.append("Added harmonic air (+1.5dB) for an uplifting, vibrant tone.")

        summary_text = " ".join(explanations) if explanations else "Aligned stem dynamics to your core listening profile."
        return dsp_params, summary_text
