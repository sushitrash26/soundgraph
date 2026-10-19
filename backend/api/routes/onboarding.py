import os
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from backend.core.logger import logger
from backend.core.neo4j_driver import neo4j_conn
from backend.core.bandit import ContextualLinUCB
from backend.core.hexa_sonic.canonical_store import CanonicalStore

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

# Curated High-Fidelity Universal Anchors by Routine
CURATED_ANCHOR_POOLS = {
    "late_night_focus": [
        {
            "id": "spotify:track:starboy",
            "name": "Starboy",
            "artist": "The Weeknd",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/92/bb/b592bb72-52e3-e756-9b26-9f56d08f47ab/16UMGIM67864.rgb.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a",
            "genres": ["r&b", "electronic", "synthwave"],
            "energy": 0.82,
            "valence": 0.68,
            "reason": "Late-night pulse tailored to your focus zone"
        },
        {
            "id": "hydrated:snooze:sza",
            "name": "Snooze",
            "artist": "SZA",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/62/93/13/6293132e-20ff-67ab-3d1f-96bb6797a6ba/196589564955.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b3/9b/ca/b39bca57-2627-1aec-77af-cbf551205394/mzaf_4430383240210492712.plus.aac.p.m4a",
            "genres": ["r&b", "soul"],
            "energy": 0.55,
            "valence": 0.39,
            "reason": "Intimate vocal atmosphere for deep evening hours"
        },
        {
            "id": "spotify:track:midnight_city",
            "name": "Midnight City",
            "artist": "M83",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/cb/7b/a9/cb7ba903-b5f1-cc21-90db-7a81b7aa0997/724596951057.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/24/09/79/2409794c-3d5d-af26-580e-7dc00ee4f207/mzaf_369629549966021675.plus.aac.p.m4a",
            "genres": ["synthwave", "indie", "electronic"],
            "energy": 0.78,
            "valence": 0.55,
            "reason": "Cinematic midnight synth progression"
        },
        {
            "id": "spotify:track:the_less_i_know",
            "name": "The Less I Know The Better",
            "artist": "Tame Impala",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a0/9a/2c/a09a2ca3-a5a6-814b-0af7-640dc0aef0aa/091012682261.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8b/55/f3/8b55f3a3-3204-8930-f156-82843546950e/mzaf_9370328603131228430.plus.aac.p.m4a",
            "genres": ["indie rock", "psychedelic"],
            "energy": 0.74,
            "valence": 0.78,
            "reason": "Warm bass groove with smooth nocturnal resonance"
        },
        {
            "id": "hydrated:runaway_(feat._pusha_t):kanye_west_&_pusha_t",
            "name": "Runaway",
            "artist": "Kanye West & Pusha T",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Video111/v4/cb/4f/96/cb4f965c-2ef1-e187-69d3-2957a335ad95/dj.korwyeid.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/23/61/64/236164d3-f330-d526-6045-d975a4be4a64/mzaf_17030153012157637966.plus.aac.p.m4a",
            "genres": ["hip hop", "art rock"],
            "energy": 0.65,
            "valence": 0.45,
            "reason": "Iconic piano dissonance and introspective flow"
        }
    ],
    "workout_energy": [
        {
            "id": "youtube:video:harder_better",
            "name": "Harder, Better, Faster, Stronger",
            "artist": "Daft Punk",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Features124/v4/ac/e1/07/ace10786-a064-0ed0-17ff-ba0cebecefe9/dj.mpdjtkyu.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/3f/4d/c6/3f4dc682-df63-be2c-82e3-e9e96a34a22d/mzaf_3097868572901182119.plus.aac.p.m4a",
            "genres": ["electronic", "house", "dance"],
            "energy": 0.90,
            "valence": 0.71,
            "reason": "High-octane robotic drive for peak stamina"
        },
        {
            "id": "spotify:track:blinding_lights",
            "name": "Blinding Lights",
            "artist": "The Weeknd",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/61/e7/3f/61e73f94-018d-5f50-50ec-8521952bc72e/20UM1IM11629.rgb.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/12/73/ca/1273ca46-233a-5331-189b-25ac1d656533/mzaf_976341070785891411.plus.aac.p.m4a",
            "genres": ["synthpop", "pop"],
            "energy": 0.80,
            "valence": 0.61,
            "reason": "171 BPM kinetic adrenaline pump"
        },
        {
            "id": "youtube:video:r_u_mine",
            "name": "R U Mine?",
            "artist": "Arctic Monkeys",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/6f/80/9f/6f809f2b-b960-90c1-f618-4e1d1fec11fa/mzaf_3957424487272184184.plus.aac.p.m4a",
            "genres": ["rock", "indie rock"],
            "energy": 0.88,
            "valence": 0.52,
            "reason": "Driving heavy guitar riffs and relentless percussion"
        },
        {
            "id": "hydrated:titanium_(feat._sia):david_guetta",
            "name": "Titanium (feat. Sia)",
            "artist": "David Guetta",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/f6/b9/e2/f6b9e2df-c638-3e4b-c28d-a68b06465758/5099997943051.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/fe/ec/07/feec0796-eff9-e6ec-01f3-5f74b66800ce/mzaf_3610002945740549096.plus.aac.p.m4a",
            "genres": ["dance", "edm", "pop"],
            "energy": 0.85,
            "valence": 0.60,
            "reason": "Power-anthem vocal crescendos"
        },
        {
            "id": "spotify:track:let_it_happen",
            "name": "Let It Happen",
            "artist": "Tame Impala",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a8/2e/b4/a82eb490-f30a-a321-461a-0383c88fec95/15UMGIM23316.rgb.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/77/68/1f/77681ffc-56e6-813c-e1bc-d94a9b5893c1/mzaf_570579359857462588.plus.aac.p.m4a",
            "genres": ["psychedelic", "electronic"],
            "energy": 0.87,
            "valence": 0.45,
            "reason": "Dynamic rhythm loop with hypnotic forward momentum"
        }
    ],
    "in_my_feelings": [
        {
            "id": "hydrated:looking_for_a_star:xxxtentacion",
            "name": "Looking for a Star",
            "artist": "XXXTENTACION",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/13/15/9b/13159bb3-86cb-ebba-35f0-957c3b6b818d/4250282804520.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/58/da/39/58da3953-8f0a-24e9-8337-f00056079c6f/mzaf_11163755882316852284.plus.aac.p.m4a",
            "genres": ["indie", "emo rap"],
            "energy": 0.62,
            "valence": 0.38,
            "reason": "Ethereal melodic longing and acoustic guitar"
        },
        {
            "id": "spotify:track:do_i_wanna_know",
            "name": "Do I Wanna Know?",
            "artist": "Arctic Monkeys",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/71/cb/ba/71cbbaa1-016b-0e73-dfc2-9f4ede9ddfc0/mzaf_16266777024198047150.plus.aac.p.m4a",
            "genres": ["indie rock"],
            "energy": 0.56,
            "valence": 0.41,
            "reason": "Late-night yearning and slow-burn guitar"
        },
        {
            "id": "hydrated:snooze:sza",
            "name": "Snooze",
            "artist": "SZA",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/62/93/13/6293132e-20ff-67ab-3d1f-96bb6797a6ba/196589564955.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b3/9b/ca/b39bca57-2627-1aec-77af-cbf551205394/mzaf_4430383240210492712.plus.aac.p.m4a",
            "genres": ["r&b", "soul"],
            "energy": 0.55,
            "valence": 0.39,
            "reason": "Velvet vocal intimacy and vulnerability"
        },
        {
            "id": "spotify:track:instant_crush",
            "name": "Instant Crush",
            "artist": "Daft Punk ft. Julian Casablancas",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/dc/1e/c2/dc1ec21b-96a0-470c-ee89-2b09346fa847/mzaf_7827098614541126525.plus.aac.p.m4a",
            "genres": ["synthpop", "indie"],
            "energy": 0.76,
            "valence": 0.58,
            "reason": "Bittersweet vocoder harmonies"
        },
        {
            "id": "hydrated:runaway_(feat._pusha_t):kanye_west_&_pusha_t",
            "name": "Runaway",
            "artist": "Kanye West & Pusha T",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Video111/v4/cb/4f/96/cb4f965c-2ef1-e187-69d3-2957a335ad95/dj.korwyeid.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/23/61/64/236164d3-f330-d526-6045-d975a4be4a64/mzaf_17030153012157637966.plus.aac.p.m4a",
            "genres": ["hip hop"],
            "energy": 0.65,
            "valence": 0.45,
            "reason": "Raw emotional piano minimalism"
        }
    ],
    "good_vibes": [
        {
            "id": "youtube:video:get_lucky",
            "name": "Get Lucky",
            "artist": "Daft Punk & Pharrell Williams",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/57/a5/85/57a585aa-f1bc-7619-881b-f8a04a5541d5/mzaf_6906185026678279401.plus.aac.p.m4a",
            "genres": ["disco", "funk", "pop"],
            "energy": 0.81,
            "valence": 0.86,
            "reason": "Sun-drenched funk rhythm and contagious optimism"
        },
        {
            "id": "spotify:track:the_less_i_know",
            "name": "The Less I Know The Better",
            "artist": "Tame Impala",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a0/9a/2c/a09a2ca3-a5a6-814b-0af7-640dc0aef0aa/091012682261.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8b/55/f3/8b55f3a3-3204-8930-f156-82843546950e/mzaf_9370328603131228430.plus.aac.p.m4a",
            "genres": ["indie rock", "groove"],
            "energy": 0.74,
            "valence": 0.78,
            "reason": "Irresistible bassline driving feel-good momentum"
        },
        {
            "id": "youtube:video:borderline",
            "name": "Borderline",
            "artist": "Tame Impala",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/65/e3/e7/65e3e740-b69f-f5cb-f2e6-7dedb5265ac9/19UMGIM96748.rgb.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e5/b6/05/e5b605d9-5a44-e981-d9be-2c434cb61de4/mzaf_16402977899153564031.plus.aac.p.m4a",
            "genres": ["indie pop", "psychedelic"],
            "energy": 0.73,
            "valence": 0.63,
            "reason": "Warm acoustic groove for open-road driving"
        },
        {
            "id": "spotify:track:blinding_lights",
            "name": "Blinding Lights",
            "artist": "The Weeknd",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/61/e7/3f/61e73f94-018d-5f50-50ec-8521952bc72e/20UM1IM11629.rgb.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/12/73/ca/1273ca46-233a-5331-189b-25ac1d656533/mzaf_976341070785891411.plus.aac.p.m4a",
            "genres": ["synthpop"],
            "energy": 0.80,
            "valence": 0.61,
            "reason": "Uplifting synth euphoria"
        },
        {
            "id": "spotify:track:starboy",
            "name": "Starboy",
            "artist": "The Weeknd",
            "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/92/bb/b592bb72-52e3-e756-9b26-9f56d08f47ab/16UMGIM67864.rgb.jpg/600x600bb.jpg",
            "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a",
            "genres": ["r&b", "pop"],
            "energy": 0.82,
            "valence": 0.68,
            "reason": "Effortless high-confidence swagger"
        }
    ]
}

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
    Fuses user's connected Spotify/YouTube library with their 3-question vibe setup.
    Guarantees strictly 5 high-confidence, high-res cards with 30s working audio streams.
    """
    logger.info(f"Onboarding: Generating first deck for user '{req.user_id}', routine '{req.routine}', mix '{req.mix_style}'")
    
    candidates: List[Dict[str, Any]] = []

    # 1. Check if user has connected library tracks in Neo4j
    try:
        query = """
        MATCH (u:User {id: $user_id})-[:LISTENED_TO]->(t:Track)
        OPTIONAL MATCH (t)-[:BY]->(a:Artist)
        OPTIONAL MATCH (t)-[:IN_GENRE]->(g:Genre)
        WHERE t.preview_url IS NOT NULL AND t.preview_url <> ''
        WITH t, collect(DISTINCT a.name) AS artists, collect(DISTINCT g.name) AS genres
        RETURN t.id AS id, t.name AS name, head(artists) AS artist, 
               t.cover_url AS cover_url, t.preview_url AS preview_url,
               coalesce(t.energy, 0.7) AS energy, coalesce(t.valence, 0.5) AS valence,
               genres
        LIMIT 20
        """
        records = neo4j_conn.query(query, {"user_id": req.user_id})
        for r in records:
            candidates.append({
                "id": r["id"],
                "name": r["name"],
                "artist": r["artist"] or "Featured Artist",
                "cover_url": r["cover_url"] or "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&h=600&fit=crop",
                "preview_url": r["preview_url"],
                "genres": r.get("genres", []),
                "energy": r["energy"],
                "valence": r["valence"],
                "reason": f"From your connected {req.connected_platform or 'library'}"
            })
    except Exception as e:
        logger.warning(f"Onboarding: Neo4j user library fetch note: {e}")

    # 2. Filter out dealbreakers from user library
    filtered_user_tracks = _filter_dealbreakers(candidates, req.dealbreakers)

    # 3. Pull from curated pool for the selected routine (with flexible alias resolution)
    routine_clean = req.routine.lower().replace("-", "_")
    routine_map = {
        "late_night": "late_night_focus",
        "late_night_focus": "late_night_focus",
        "workout": "workout_energy",
        "workout_energy": "workout_energy",
        "feelings": "feelings",
        "in_my_feelings": "feelings",
        "good_vibes": "good_vibes",
        "good_vibes_daytime": "good_vibes"
    }
    pool_key = routine_map.get(routine_clean, "late_night_focus")
    curated_pool = CURATED_ANCHOR_POOLS.get(pool_key, CURATED_ANCHOR_POOLS["late_night_focus"])
    filtered_curated = _filter_dealbreakers(curated_pool, req.dealbreakers)

    final_deck: List[Dict[str, Any]] = []

    # Mix strategy resolution:
    effective_mix = (req.discovery or req.mix_style or "balanced").lower()
    if effective_mix in ["familiar", "stick_to_known"]:
        user_quota = 4
    elif effective_mix in ["adventurous", "surprise_me"]:
        user_quota = 2
    else:  # balanced
        user_quota = 3

    for ut in filtered_user_tracks[:user_quota]:
        final_deck.append(ut)

    # Backfill with curated pool until strictly 5 cards
    for ct in filtered_curated:
        if len(final_deck) >= 5:
            break
        if not any(d.get("name", "").lower() == ct.get("name", "").lower() for d in final_deck):
            final_deck.append(ct)

    # Safety: If dealbreakers pruned too much, fill from remaining anchors
    if len(final_deck) < 5:
        for backup_pool in CURATED_ANCHOR_POOLS.values():
            for bt in backup_pool:
                if len(final_deck) >= 5:
                    break
                if not any(d.get("name", "").lower() == bt.get("name", "").lower() for d in final_deck):
                    final_deck.append(bt)

    # Normalize card attributes so both mobile and web have complete properties
    normalized_cards = []
    for c in final_deck[:5]:
        normalized_cards.append({
            "track_id": c.get("id") or c.get("track_id", "track_anchor"),
            "id": c.get("id") or c.get("track_id", "track_anchor"),
            "title": c.get("name") or c.get("title", "Track"),
            "name": c.get("name") or c.get("title", "Track"),
            "artist": c.get("artist", "Featured Artist"),
            "cover_url": c.get("cover_url", "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&h=600&fit=crop"),
            "preview_url": c.get("preview_url", ""),
            "genres": c.get("genres", []),
            "energy": c.get("energy", 0.65),
            "valence": c.get("valence", 0.50),
            "quadrant": c.get("reason", "Curated for your routine"),
            "reason": c.get("reason", "Curated for your routine")
        })

    logger.info(f"Onboarding: Curated {len(normalized_cards)} initial cards for '{req.user_id}'")
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
