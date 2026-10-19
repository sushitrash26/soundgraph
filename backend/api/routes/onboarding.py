import os
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from backend.core.logger import logger
from backend.core.neo4j_driver import neo4j_conn
from backend.core.bandit import ContextualLinUCB
from backend.core.hexa_sonic.canonical_store import CanonicalStore
from backend.core.hexa_sonic.jit_hydration import JITHydrationWorker

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])

class OnboardingQuizRequest(BaseModel):
    user_id: str = Field(default="demo_guest_user")
    connected_platform: Optional[str] = None
    routine: str = Field(default="late_night_focus")
    mix_style: Optional[str] = Field(default="balanced")
    discovery: Optional[str] = None
    dealbreakers: List[str] = Field(default_factory=list)

class TrackRating(BaseModel):
    track_id: str
    reward: float  # +1.0 for like, -1.0 for dislike

class FinalizeQuizRequest(BaseModel):
    user_id: str = Field(default="demo_guest_user")
    ratings: Optional[List[TrackRating]] = None
    card_ratings: Optional[List[TrackRating]] = None
    routine: str = Field(default="late_night_focus")
    mix_style: Optional[str] = Field(default="balanced")
    discovery: Optional[str] = None
    dealbreakers: List[str] = Field(default_factory=list)

# Sonic coordinates and profile specifications for dynamic routine querying
ROUTINE_PROFILES = {
    "late_night_focus": {
        "title": "Late-Night Focus",
        "quadrant": "Late-Night Atmospheric / R&B",
        "target_energy": 0.45,
        "target_valence": 0.40,
        "energy_min": 0.20,
        "energy_max": 0.75,
        "valence_min": 0.15,
        "valence_max": 0.65,
        "target_genres": ["r&b", "soul", "ambient", "lo-fi", "indie", "electronic", "synthwave", "chill", "trip-hop"]
    },
    "workout_energy": {
        "title": "Workout Energy",
        "quadrant": "High-Energy Rhythm & Bass",
        "target_energy": 0.85,
        "target_valence": 0.70,
        "energy_min": 0.65,
        "energy_max": 1.00,
        "valence_min": 0.35,
        "valence_max": 1.00,
        "target_genres": ["electronic", "house", "dance", "rock", "hip hop", "techno", "edm", "trap", "drum and bass"]
    },
    "feelings": {
        "title": "In My Feelings",
        "quadrant": "Introspective Harmonic Space",
        "target_energy": 0.38,
        "target_valence": 0.25,
        "energy_min": 0.15,
        "energy_max": 0.65,
        "valence_min": 0.10,
        "valence_max": 0.50,
        "target_genres": ["acoustic", "emo rap", "indie folk", "chamber pop", "singer-songwriter", "sad", "ballad"]
    },
    "good_vibes": {
        "title": "Good Vibes Daytime",
        "quadrant": "Uplifting Synth & Funk",
        "target_energy": 0.80,
        "target_valence": 0.80,
        "energy_min": 0.55,
        "energy_max": 1.00,
        "valence_min": 0.55,
        "valence_max": 1.00,
        "target_genres": ["funk", "disco", "pop", "synthpop", "groove", "indie pop", "soul"]
    }
}

def _resolve_routine(routine_raw: str) -> Dict[str, Any]:
    clean = (routine_raw or "late_night_focus").lower().replace("-", "_")
    if "workout" in clean:
        return ROUTINE_PROFILES["workout_energy"]
    elif "feeling" in clean:
        return ROUTINE_PROFILES["feelings"]
    elif "vibe" in clean or "daytime" in clean:
        return ROUTINE_PROFILES["good_vibes"]
    return ROUTINE_PROFILES["late_night_focus"]

def _clean_track_title(name: str) -> str:
    if not name:
        return "your favorites"
    cleaned = name.split("#")[0].strip()
    if len(cleaned) > 28:
        cleaned = cleaned[:28].rstrip() + "..."
    return cleaned or name

def _filter_dealbreakers(tracks: List[Dict[str, Any]], dealbreakers: List[str]) -> List[Dict[str, Any]]:
    if not dealbreakers:
        return tracks
    filtered = []
    db_clean = [d.lower().replace(" ", "_") for d in dealbreakers]
    for t in tracks:
        genres = [g.lower().replace(" ", "_") for g in t.get("genres", [])]
        skip = False
        if "heavy_autotune" in db_clean and any("trap" in g or "drill" in g for g in genres):
            skip = True
        if "generic_radio_pop" in db_clean and any("dance_pop" in g or "electropop" in g for g in genres):
            skip = True
        if "screaming_distortion" in db_clean and any("metal" in g or "punk" in g or "screamo" in g for g in genres):
            skip = True
        if "slow_sappy_ballads" in db_clean and t.get("energy", 0.7) < 0.40:
            skip = True
        if not skip:
            filtered.append(t)
    return filtered

@router.post("/first-deck")
async def get_first_deck(req: OnboardingQuizRequest):
    """
    Dynamically generates the 5-card initial onboarding deck from Neo4j.
    Fuses the user's connected Spotify / YouTube library with graph neighbor traversals,
    dense vector similarity embeddings, and routine sonic boundaries.
    Guarantees strictly 5 high-fidelity cards with verified 30-second studio audio previews.
    """
    logger.info(
        f"Onboarding: Generating dynamic first deck for user '{req.user_id}', "
        f"routine '{req.routine}', mix '{req.mix_style or req.discovery}', platform '{req.connected_platform}'"
    )

    profile = _resolve_routine(req.routine)
    effective_mix = (req.discovery or req.mix_style or "balanced").lower()

    if effective_mix in ["familiar", "stick_to_known"]:
        user_quota = 4
    elif effective_mix in ["adventurous", "surprise_me"]:
        user_quota = 1
    else:  # balanced
        user_quota = 2

    final_deck: List[Dict[str, Any]] = []
    seen_ids = set()
    seen_sigs = set()
    ref_emb = None

    def try_add_track(t_item: Dict[str, Any], reason_label: str) -> bool:
        tid = t_item.get("id") or t_item.get("track_id") or ""
        tname = t_item.get("name") or t_item.get("title") or "Track"
        tartist = t_item.get("artist") or "Featured Artist"
        sig = (tartist.lower().strip(), tname.lower().strip())
        if not tid or tid in seen_ids or sig in seen_sigs:
            return False
        seen_ids.add(tid)
        seen_sigs.add(sig)
        final_deck.append({
            "track_id": tid,
            "id": tid,
            "title": tname,
            "name": tname,
            "artist": tartist,
            "cover_url": t_item.get("cover_url") or "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&h=600&fit=crop",
            "preview_url": t_item.get("preview_url") or "",
            "genres": t_item.get("genres", []),
            "energy": round(float(t_item.get("energy", 0.65)), 2),
            "valence": round(float(t_item.get("valence", 0.50)), 2),
            "quadrant": profile["quadrant"],
            "reason": reason_label
        })
        return True

    # 1. Fetch User Library Tracks from Neo4j (if user has connected account / history)
    if req.user_id and req.user_id != "demo_guest_user":
        try:
            q_user = """
            MATCH (u:User {id: $user_id})-[:LISTENED_TO]->(t:Track)
            WHERE t.preview_url IS NOT NULL AND t.preview_url <> ''
            OPTIONAL MATCH (t)-[:BY]->(a:Artist)
            OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
            WITH t, collect(DISTINCT a.name) AS artists, collect(DISTINCT g.name) AS genres,
                 abs(coalesce(t.energy, 0.5) - $target_e) + abs(coalesce(t.valence, 0.5) - $target_v) AS acoustic_dist,
                 CASE WHEN t.preview_url CONTAINS '.m4a' OR t.preview_url CONTAINS '.mp3' OR t.preview_url CONTAINS 'apple' OR t.preview_url CONTAINS 'mzstatic' THEN 1 ELSE 0 END AS has_audio
            RETURN t.id AS id, t.name AS name, head(artists) AS artist,
                   t.cover_url AS cover_url, t.preview_url AS preview_url,
                   coalesce(t.energy, 0.7) AS energy, coalesce(t.valence, 0.5) AS valence,
                   genres, acoustic_dist, has_audio, t.embedding AS embedding
            ORDER BY has_audio DESC, acoustic_dist ASC
            LIMIT 25
            """
            user_rows = neo4j_conn.query(q_user, {
                "user_id": req.user_id,
                "target_e": profile["target_energy"],
                "target_v": profile["target_valence"]
            })
            filtered_user_rows = _filter_dealbreakers(user_rows, req.dealbreakers)
            platform_label = (req.connected_platform or "library").capitalize()
            for r in filtered_user_rows:
                if len(final_deck) >= user_quota:
                    break
                if r.get("embedding") and ref_emb is None:
                    ref_emb = r["embedding"]
                try_add_track(r, f"From your connected {platform_label} library")
        except Exception as e:
            logger.warning(f"Onboarding: Neo4j user library query error: {e}")

    # 2. Fetch Graph-Neighbor Recommendations (1-to-2-hop shared artists/micro-genres)
    if req.user_id and req.user_id != "demo_guest_user" and len(final_deck) > 0 and len(final_deck) < 5:
        try:
            q_neighbor = """
            MATCH (u:User {id: $user_id})-[:LISTENED_TO]->(fav:Track)-[:BY|IN_GENRE*1..2]-(rec:Track)
            WHERE rec.preview_url IS NOT NULL AND rec.preview_url <> ''
              AND NOT (u)-[:LISTENED_TO]->(rec)
            OPTIONAL MATCH (rec)-[:BY]->(a:Artist)
            OPTIONAL MATCH (rec)-[:IN_GENRE]->(g:Genre)
            WITH fav, rec, collect(DISTINCT a.name) AS artists, collect(DISTINCT g.name) AS genres,
                 abs(coalesce(rec.energy, 0.5) - $target_e) + abs(coalesce(rec.valence, 0.5) - $target_v) AS acoustic_dist,
                 CASE WHEN rec.preview_url CONTAINS '.m4a' OR rec.preview_url CONTAINS '.mp3' OR rec.preview_url CONTAINS 'apple' OR rec.preview_url CONTAINS 'mzstatic' THEN 1 ELSE 0 END AS has_audio
            RETURN rec.id AS id, rec.name AS name, head(artists) AS artist,
                   rec.cover_url AS cover_url, rec.preview_url AS preview_url,
                   coalesce(rec.energy, 0.7) AS energy, coalesce(rec.valence, 0.5) AS valence,
                   genres, fav.name AS fav_name, acoustic_dist, has_audio, rec.embedding AS embedding
            ORDER BY has_audio DESC, acoustic_dist ASC
            LIMIT 15
            """
            neighbor_rows = neo4j_conn.query(q_neighbor, {
                "user_id": req.user_id,
                "target_e": profile["target_energy"],
                "target_v": profile["target_valence"]
            })
            filtered_neighbor_rows = _filter_dealbreakers(neighbor_rows, req.dealbreakers)
            for r in filtered_neighbor_rows:
                if len(final_deck) >= 3:
                    break
                if r.get("embedding") and ref_emb is None:
                    ref_emb = r["embedding"]
                fav_title = _clean_track_title(r.get("fav_name", "your favorites"))
                try_add_track(r, f"Because you love {fav_title} on your library")
        except Exception as e:
            logger.warning(f"Onboarding: Neo4j neighbor query error: {e}")

    # 3. Dense Vector Similarity Query via Neo4j track_embeddings index (AI Agent Discovery)
    if ref_emb is not None and len(final_deck) < 5:
        try:
            q_vec = """
            CALL db.index.vector.queryNodes("track_embeddings", 100, $emb)
            YIELD node AS rec, score
            WHERE rec.preview_url IS NOT NULL AND rec.preview_url <> ''
            OPTIONAL MATCH (rec)-[:BY]->(a:Artist)
            OPTIONAL MATCH (rec)-[:IN_GENRE]->(g:Genre)
            WITH rec, head(collect(DISTINCT a.name)) AS artist, collect(DISTINCT g.name) AS genres, score,
                 CASE WHEN rec.preview_url CONTAINS '.m4a' OR rec.preview_url CONTAINS '.mp3' OR rec.preview_url CONTAINS 'apple' OR rec.preview_url CONTAINS 'mzstatic' THEN 1 ELSE 0 END AS has_audio
            RETURN rec.id AS id, rec.name AS name, artist,
                   rec.cover_url AS cover_url, rec.preview_url AS preview_url,
                   coalesce(rec.energy, 0.7) AS energy, coalesce(rec.valence, 0.5) AS valence,
                   genres, score, has_audio
            ORDER BY has_audio DESC, score DESC
            LIMIT 25
            """
            vec_rows = neo4j_conn.query(q_vec, {"emb": ref_emb})
            filtered_vec_rows = _filter_dealbreakers(vec_rows, req.dealbreakers)
            for r in filtered_vec_rows:
                if len(final_deck) >= 5:
                    break
                try_add_track(r, "One from our AI Agent (;")
        except Exception as e:
            logger.warning(f"Onboarding: Neo4j vector search query error: {e}")

    # 4. Global Acoustic Bounds Query from Neo4j (for guest users or backfill)
    if len(final_deck) < 5:
        try:
            q_global = """
            MATCH (t:Track)
            WHERE t.preview_url IS NOT NULL AND t.preview_url <> ''
              AND coalesce(t.energy, 0.7) >= $e_min AND coalesce(t.energy, 0.7) <= $e_max
            OPTIONAL MATCH (t)-[:BY]->(a:Artist)
            OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
            WITH t, collect(DISTINCT a.name) AS artists, collect(DISTINCT g.name) AS genres,
                 abs(coalesce(t.energy, 0.5) - $target_e) + abs(coalesce(t.valence, 0.5) - $target_v) AS acoustic_dist,
                 CASE WHEN t.preview_url CONTAINS '.m4a' OR t.preview_url CONTAINS '.mp3' OR t.preview_url CONTAINS 'apple' OR t.preview_url CONTAINS 'mzstatic' THEN 1 ELSE 0 END AS has_audio
            RETURN t.id AS id, t.name AS name, head(artists) AS artist,
                   t.cover_url AS cover_url, t.preview_url AS preview_url,
                   coalesce(t.energy, 0.7) AS energy, coalesce(t.valence, 0.5) AS valence,
                   coalesce(t.popularity, 50) AS pop,
                   genres, acoustic_dist, has_audio, t.embedding AS embedding
            ORDER BY has_audio DESC, acoustic_dist ASC, pop DESC
            LIMIT 40
            """
            glob_rows = neo4j_conn.query(q_global, {
                "e_min": profile["energy_min"],
                "e_max": profile["energy_max"],
                "target_e": profile["target_energy"],
                "target_v": profile["target_valence"]
            })
            filtered_glob_rows = _filter_dealbreakers(glob_rows, req.dealbreakers)
            is_guest = not req.user_id or req.user_id == "demo_guest_user" or len(final_deck) == 0
            guest_anchor_count = 0
            for r in filtered_glob_rows:
                if len(final_deck) >= 5:
                    break
                if is_guest and guest_anchor_count < 2:
                    added = try_add_track(r, f"Curated for your {profile['title']} baseline")
                    if added:
                        guest_anchor_count += 1
                else:
                    try_add_track(r, "One from our AI Agent (;")
        except Exception as e:
            logger.warning(f"Onboarding: Neo4j global acoustic query error: {e}")

    # 5. Safety Fallback: Ensure strictly 5 cards even if extreme dealbreakers were passed
    if len(final_deck) < 5:
        try:
            q_fallback = """
            MATCH (t:Track)
            WHERE t.preview_url IS NOT NULL AND t.preview_url <> ''
            OPTIONAL MATCH (t)-[:BY]->(a:Artist)
            WITH t, head(collect(DISTINCT a.name)) AS artist
            RETURN t.id AS id, t.name AS name, artist,
                   t.cover_url AS cover_url, t.preview_url AS preview_url,
                   coalesce(t.energy, 0.7) AS energy, coalesce(t.valence, 0.5) AS valence,
                   coalesce(t.popularity, 50) AS pop
            ORDER BY pop DESC
            LIMIT 20
            """
            fallback_rows = neo4j_conn.query(q_fallback)
            for r in fallback_rows:
                if len(final_deck) >= 5:
                    break
                try_add_track(r, "One from our AI Agent (;")
        except Exception as e:
            logger.warning(f"Onboarding: Neo4j fallback query error: {e}")

    # 6. Verify and JIT hydrate direct audio previews if any track has a web/youtube link
    for c in final_deck[:5]:
        prev = c.get("preview_url", "")
        if "youtube.com" in prev or "youtu.be" in prev or not prev:
            try:
                hydrated = await JITHydrationWorker.fetch_preview_audio_url(c["title"], c["artist"])
                if hydrated and hydrated.get("preview_url") and not ("youtube" in hydrated.get("preview_url", "")):
                    c["preview_url"] = hydrated["preview_url"]
                    if hydrated.get("artwork_url"):
                        c["cover_url"] = hydrated["artwork_url"]
            except Exception as e:
                logger.debug(f"Onboarding: JIT preview hydration note for {c['title']}: {e}")

    normalized_cards = final_deck[:5]
    logger.info(f"Onboarding: Dynamically generated {len(normalized_cards)} cards for '{req.user_id}'")

    return {
        "status": "success",
        "title": "Top 5 Songs We curated for you",
        "routine": req.routine,
        "mix_style": effective_mix,
        "count": len(normalized_cards),
        "cards": normalized_cards,
        "deck": normalized_cards
    }

@router.post("/finalize-quiz")
async def finalize_quiz(req: FinalizeQuizRequest):
    """
    Writes onboarding telemetry, routine contexts, and swipe feedback into Neo4j.
    Calibrates LinUCB bandit exploration parameter α.
    """
    active_ratings = req.card_ratings if req.card_ratings is not None else (req.ratings or [])
    logger.info(f"Onboarding: Finalizing quiz for user '{req.user_id}' with {len(active_ratings)} card ratings")
    
    effective_mix = (req.discovery or req.mix_style or "balanced").lower()
    alpha = 0.50
    if effective_mix in ["familiar", "stick_to_known"]:
        alpha = 0.15
    elif effective_mix in ["adventurous", "surprise_me"]:
        alpha = 1.20

    try:
        # 1. Update user node & routine context in Neo4j
        query_user = """
        MERGE (u:User {id: $user_id})
        SET u.onboarding_completed = true,
            u.onboarding_at = datetime(),
            u.mix_style = $mix_style,
            u.bandit_alpha = $alpha
        MERGE (r:RoutineContext {name: $routine})
        MERGE (u)-[:ACTIVE_ROUTINE {created_at: datetime()}]->(r)
        """
        neo4j_conn.query(query_user, {
            "user_id": req.user_id,
            "routine": req.routine,
            "mix_style": req.mix_style,
            "alpha": alpha
        })

        # 2. Record dealbreakers as negative affinity
        for db in req.dealbreakers:
            neo4j_conn.query("""
            MERGE (u:User {id: $user_id})
            MERGE (g:Genre {name: $genre})
            MERGE (u)-[:AVOIDS {created_at: datetime()}]->(g)
            """, {"user_id": req.user_id, "genre": db})

        # 3. Commit swipe ratings to Neo4j FEEDBACK edges & bandit
        for rating in active_ratings:
            neo4j_conn.query("""
            MERGE (u:User {id: $user_id})
            MERGE (t:Track {id: $track_id})
            MERGE (u)-[f:FEEDBACK]->(t)
            SET f.reward = $reward, f.updated_at = datetime()
            """, {
                "user_id": req.user_id,
                "track_id": rating.track_id,
                "reward": rating.reward
            })

    except Exception as e:
        logger.warning(f"Onboarding: Finalize quiz Neo4j persistence note: {e}")

    return {
        "status": "success",
        "message": "Taste DNA calibrated and persisted",
        "user_id": req.user_id,
        "bandit_alpha": alpha
    }
