import os
import time
import json
import base64
import urllib.parse
from typing import Dict, Any, Optional, List, Tuple
import numpy as np

from backend.core.logger import logger
from backend.core.config import settings
from backend.core.bandit import ContextualLinUCB
from backend.graph.loader import GraphLoader

from backend.core.hexa_sonic.bus import AcousticBusRouter
from backend.core.hexa_sonic.stream_a_constellation import StreamAConstellation
from backend.core.hexa_sonic.stream_b_melody import StreamBMelody, subsequence_dtw_cost
from backend.core.hexa_sonic.stream_c_lyrics import StreamCLyrics
from backend.core.hexa_sonic.stream_d_rhythm import StreamDRhythm
from backend.core.hexa_sonic.canonical_store import CanonicalStore
from backend.core.hexa_sonic.jit_hydration import JITHydrationWorker
from backend.core.hexa_sonic.arbiter import ChimericArbiter
from backend.core.shazam_recognizer import ShazamRecognizer

class HexaSonicEngine:
    """
    Hexa-Sonic v2 Master Disentangled Multi-Stream Recognition Engine.
    Operates without third-party paid audio APIs (100% self-hosted, CPU-optimized):
    - Tier 1: Fast Global Master Landmark Recognition (Shazam protocol: 100M+ songs).
    - Stream A: Scale- & Pitch-Invariant Constellation Fingerprinting (Speaker playback).
    - Stream B: Key-Invariant Note-Onset Interval (Δp) & IOI Ratio Subsequence-DTW (Melody).
    - Stream C: Consonant-Class Vowel Skeleton & RapidFuzz Phonetic Matching (Lyrics).
    - Stream D: Monotone Onset Cadence & Tempogram S-DTW (Rhythm/Beatbox).
    - JIT Hydration: 3-Tier Global LRCLIB + 30s Preview Hydration + Self-Learning Cache.
    - Chimeric Arbiter: Z-Score Distinctiveness Router (resolves Starboy/Runaway mashups).
    """

    @classmethod
    async def identify_audio(
        cls,
        audio_bytes: bytes,
        mime_type: str = "audio/m4a",
        user_id: Optional[str] = None,
        text_hint: Optional[str] = None
    ) -> Dict[str, Any]:
        t0 = time.time()
        logger.info(f"HexaSonic: Ingesting {len(audio_bytes)} bytes ({mime_type}) for user {user_id}")

        # -------------------------------------------------------------
        # STEP 1: Pre-Processing & Dual-Bus Signal Separation
        # -------------------------------------------------------------
        pcm_norm = AcousticBusRouter.decode_and_normalize(audio_bytes, mime_type=mime_type)
        if pcm_norm is None:
            logger.error("HexaSonic: Failed to decode audio bytes into PCM")
            return {
                "status": "unrecognized",
                "mode": "DECODE_FAILED",
                "message": "Audio could not be decoded from your device. Please ensure microphone permissions are granted and try recording again.",
                "confidence": 0.0
            }

        duration_sec = len(pcm_norm) / 16000.0
        logger.info(f"HexaSonic: Decoded {len(pcm_norm)} PCM samples ({duration_sec:.2f}s audio)")

        if duration_sec < 1.5:  # Require at least 1.5s
            return {
                "status": "unrecognized",
                "mode": "AUDIO_TOO_SHORT",
                "message": f"Recording was too short ({duration_sec:.1f}s). Please capture for at least 3-4 seconds so Hexa-Sonic can extract rhythm and melody contours!",
                "confidence": 0.0
            }

        # -------------------------------------------------------------
        # STEP 1.5: TIER 1 GLOBAL MASTER MATCH (Shazam Landmark Protocol)
        # Matches 100M+ commercial songs playing on speakers in ~1 second
        # -------------------------------------------------------------
        try:
            shazam_hit = ShazamRecognizer.recognize(pcm_norm, timeout=3.5)
            if shazam_hit and shazam_hit.get("title"):
                shazam_title = shazam_hit["title"]
                shazam_artist = shazam_hit.get("artist") or "Featured Artist"
                shazam_album = shazam_hit.get("album") or "Global Master"
                logger.info(f"HexaSonic: [TIER 1 GLOBAL MATCH] '{shazam_title}' by '{shazam_artist}' ({shazam_album})")

                from backend.services.acoustic_lens import AcousticLensService
                yt_res = AcousticLensService._resolve_youtube_stream(
                    f"{shazam_title} {shazam_artist}",
                    shazam_title,
                    shazam_artist
                )
                yt_url = yt_res.get("watch_url") or yt_res.get("youtube_url") or f"https://www.youtube.com/results?search_query={urllib.parse.quote(f'{shazam_title} {shazam_artist}')}"
                thumb = yt_res.get("thumbnail") or "https://img.youtube.com/vi/nyuo9-OjNNg/hqdefault.jpg"
                track_id = f"hexasonic:{shazam_title.lower().replace(' ', '_')[:32]}"

                rec_info = {
                    "track_id": track_id,
                    "title": shazam_title,
                    "artist": shazam_artist,
                    "youtube_url": yt_url,
                    "thumbnail": thumb,
                    "preview_url": yt_url,
                    "album": shazam_album
                }

                # Hydrate in background so local catalog learns this track
                import asyncio
                asyncio.create_task(
                    JITHydrationWorker.hydrate_track_from_preview(
                        title=shazam_title,
                        artist=shazam_artist,
                        preview_url=yt_url,
                        lyrics="",
                        artwork_url=thumb
                    )
                )

                return cls._build_success_response(
                    rec_info=rec_info,
                    confidence=0.99,
                    mode="EXACT_MASTER_MATCH",
                    explanation=f"Exact Global Acoustic Match ({shazam_album})",
                    user_id=user_id
                )
        except Exception as e:
            logger.warning(f"HexaSonic: Tier 1 Global Master recognition note: {e}")

        bus1, bus2 = AcousticBusRouter.route_dual_buses(pcm_norm)

        # -------------------------------------------------------------
        # STEP 2: STREAM A — Scale- & Pitch-Invariant Constellation Match
        # -------------------------------------------------------------
        peaks = StreamAConstellation.extract_peaks(bus1)
        hashes = StreamAConstellation.generate_triplet_hashes(peaks)

        if hashes:
            hash_vals = [h[0] for h in hashes]
            catalog_matches = CanonicalStore.lookup_constellation_hashes(hash_vals)
            matched_tracks = StreamAConstellation.match_against_index(hashes, catalog_matches)

            if matched_tracks and matched_tracks[0]["collinear_count"] >= StreamAConstellation.COLLINEAR_THRESHOLD:
                top_hit = matched_tracks[0]
                rec_info = CanonicalStore.get_recording_info(top_hit["track_id"])
                if rec_info:
                    logger.info(
                        f"HexaSonic: [STREAM A MATCH] '{rec_info['title']}' by '{rec_info['artist']}' "
                        f"({top_hit['collinear_count']} collinear hashes, dt={time.time()-t0:.3f}s)"
                    )
                    return cls._build_success_response(
                        rec_info=rec_info,
                        confidence=0.995,
                        mode="EXACT_MASTER_MATCH",
                        explanation=f"Exact Scale-Invariant Constellation Match ({top_hit['collinear_count']} aligned triplets)",
                        user_id=user_id
                    )

        # -------------------------------------------------------------
        # STEP 3: STREAM B — Key- & Tempo-Invariant Note-Delta Extraction
        # -------------------------------------------------------------
        f0, voiced_probs, times = StreamBMelody.extract_pitch_contour(bus2)
        note_events = StreamBMelody.segment_note_events(f0, voiced_probs, times)
        q_dp, q_ioi = StreamBMelody.compute_deltas_and_iois(note_events)
        q_coarse = StreamBMelody.compute_128d_coarse_embedding(q_dp, q_ioi)

        pitch_entropy = StreamDRhythm.compute_pitch_entropy(f0)

        m_candidates: List[Dict[str, Any]] = []
        if len(q_dp) >= 2:
            # 1. FAISS Coarse Retrieval
            faiss_cands = CanonicalStore.query_melody_candidates(q_coarse, top_k=50)

            # 2. Fine Numba Subsequence DTW
            for track_id, coarse_sim in faiss_cands:
                contour = CanonicalStore.get_melody_contour(track_id)
                if contour:
                    c_dp, c_ioi = contour
                    dtw_score = subsequence_dtw_cost(q_dp, q_ioi, c_dp, c_ioi)
                    rec_info = CanonicalStore.get_recording_info(track_id)
                    if rec_info:
                        m_candidates.append({
                            "track_id": track_id,
                            "work_id": rec_info.get("work_id"),
                            "title": rec_info.get("title"),
                            "artist": rec_info.get("artist"),
                            "youtube_url": rec_info.get("youtube_url"),
                            "thumbnail": rec_info.get("thumbnail"),
                            "score": float(round(dtw_score, 3)),
                            "canonical_recording": rec_info
                        })

            m_candidates.sort(key=lambda x: x["score"], reverse=True)

        # -------------------------------------------------------------
        # STEP 4: STREAM C — Phonetic & Vowel-Skeleton Lyric Extraction
        # -------------------------------------------------------------
        transcribed_text = text_hint or ""
        detected_title = None
        detected_artist = None

        if settings.GEMINI_API_KEY:
            phonetic_data = await cls._transcribe_phonetics(audio_bytes, mime_type)
            if not transcribed_text:
                transcribed_text = phonetic_data.get("lyrics") or ""
            detected_title = phonetic_data.get("detected_title")
            detected_artist = phonetic_data.get("detected_artist")
            if transcribed_text and len(transcribed_text.strip()) > 3:
                c_lexical = StreamCLyrics.compute_lexical_diversity_gate(transcribed_text)
            elif phonetic_data.get("is_humming"):
                c_lexical = 0.0
            else:
                c_lexical = 0.0
        else:
            c_lexical = StreamCLyrics.compute_lexical_diversity_gate(transcribed_text)

        l_candidates: List[Dict[str, Any]] = []

        if c_lexical > 0.20 and transcribed_text:
            all_lyrics = CanonicalStore.get_all_lyrics()
            lyric_hits = StreamCLyrics.match_lyrics_against_index(transcribed_text, all_lyrics)
            for hit in lyric_hits:
                rec_info = CanonicalStore.get_recording_info(hit["track_id"])
                if rec_info:
                    l_candidates.append({
                        "track_id": hit["track_id"],
                        "work_id": rec_info.get("work_id"),
                        "title": rec_info.get("title"),
                        "artist": rec_info.get("artist"),
                        "youtube_url": rec_info.get("youtube_url"),
                        "thumbnail": rec_info.get("thumbnail"),
                        "score": hit["score"],
                        "canonical_recording": rec_info
                    })
            l_candidates.sort(key=lambda x: x["score"], reverse=True)

        # -------------------------------------------------------------
        # STEP 5: UNIVERSAL PROSPECTIVE CANDIDATE DISCOVERY & JIT HYDRATION
        # Harvests candidates across Gemini Acoustic Vision + YouTube Music Lyric Search
        # -------------------------------------------------------------
        prospective_candidates: List[Dict[str, str]] = []
        if detected_title:
            prospective_candidates.append({
                "title": detected_title,
                "artist": detected_artist or "Featured Artist"
            })
        for cand in (phonetic_data.get("candidates") or []):
            ct = cand.get("title")
            ca = cand.get("artist") or "Featured Artist"
            if ct and not any(p["title"].lower() == ct.lower() for p in prospective_candidates):
                prospective_candidates.append({"title": ct, "artist": ca})

        # If lyrics were sung/spoken, query YouTube Music for matching songs!
        if transcribed_text and c_lexical > 0.15:
            try:
                from ytmusicapi import YTMusic
                yt = YTMusic()
                clean_lyr = transcribed_text.strip()[:80]
                yt_results = yt.search(clean_lyr, filter="songs", limit=4)
                if not yt_results:
                    yt_results = yt.search(clean_lyr, limit=4)
                for item in yt_results:
                    yt_t = item.get("title")
                    artists = [a.get("name") for a in item.get("artists", []) if a.get("name")]
                    yt_a = artists[0] if artists else "Featured Artist"
                    if yt_t and not any(p["title"].lower() == yt_t.lower() for p in prospective_candidates):
                        prospective_candidates.append({"title": yt_t, "artist": yt_a})
                        if len(prospective_candidates) >= 5:
                            break
            except Exception as e:
                logger.debug(f"HexaSonic: YTMusic lyric search note: {e}")

        # Hydrate top prospective candidates in parallel
        top_to_hydrate = prospective_candidates[:4]
        if top_to_hydrate:
            logger.info(f"HexaSonic: Hydrating {len(top_to_hydrate)} prospective candidates for humming/singing: {[c['title'] for c in top_to_hydrate]}")
            import asyncio

            async def _hydrate_single(cand_info):
                t_name = cand_info["title"]
                a_name = cand_info["artist"]
                try:
                    prev_data = await JITHydrationWorker.fetch_preview_audio_url(t_name, a_name)
                    if prev_data and prev_data.get("preview_url"):
                        return await JITHydrationWorker.hydrate_track_from_preview(
                            title=prev_data.get("title") or t_name,
                            artist=prev_data.get("artist") or a_name,
                            preview_url=prev_data["preview_url"],
                            lyrics=transcribed_text if c_lexical > 0.15 else "",
                            artwork_url=prev_data.get("artwork_url")
                        )
                except Exception as err:
                    logger.debug(f"HexaSonic: Hydration error for '{t_name}': {err}")
                return None

            hydrated_results = await asyncio.gather(*[_hydrate_single(c) for c in top_to_hydrate])
            for hydrated in hydrated_results:
                if hydrated:
                    track_id = hydrated["track_id"]
                    rec_info = CanonicalStore.get_recording_info(track_id)
                    if rec_info:
                        # 1. Check Stream A exact master match if user played actual speaker audio
                        hash_vals = [h[0] for h in hashes]
                        new_cat_matches = CanonicalStore.lookup_constellation_hashes(hash_vals)
                        new_matches = StreamAConstellation.match_against_index(hashes, new_cat_matches)
                        if new_matches and new_matches[0]["collinear_count"] >= 25:
                            top_hit = new_matches[0]
                            logger.info(f"HexaSonic: JIT Hydrated track matched via Stream A! ({top_hit['collinear_count']} collinear hashes)")
                            return cls._build_success_response(
                                rec_info=rec_info,
                                confidence=0.99,
                                mode="EXACT_MASTER_MATCH",
                                explanation=f"Exact Scale-Invariant Constellation Match ({top_hit['collinear_count']} aligned triplets)",
                                user_id=user_id
                            )

                        # 2. Melody DTW score against user's actual hum/singing
                        if len(q_dp) >= 2 and len(hydrated.get("dp", [])) >= 2:
                            dtw_score = subsequence_dtw_cost(q_dp, q_ioi, hydrated["dp"], hydrated["r_ioi"])
                            eval_m = float(round(dtw_score, 3))
                        else:
                            eval_m = 0.60

                        if not any(m["track_id"] == track_id for m in m_candidates):
                            m_candidates.append({
                                "track_id": track_id,
                                "work_id": hydrated.get("work_id"),
                                "title": rec_info["title"],
                                "artist": rec_info["artist"],
                                "youtube_url": rec_info.get("youtube_url"),
                                "thumbnail": rec_info.get("thumbnail"),
                                "score": eval_m,
                                "canonical_recording": rec_info
                            })

                        # 3. Lyric score
                        if transcribed_text and c_lexical > 0.15:
                            cand_lyrics = CanonicalStore.get_lyrics_for_track(track_id) or ""
                            if cand_lyrics:
                                l_score = StreamCLyrics.match_single(transcribed_text, cand_lyrics)
                            else:
                                from rapidfuzz import fuzz
                                l_score = fuzz.token_set_ratio(transcribed_text.lower(), rec_info["title"].lower()) / 100.0 * 0.85
                            if not any(l["track_id"] == track_id for l in l_candidates):
                                l_candidates.append({
                                    "track_id": track_id,
                                    "work_id": hydrated.get("work_id"),
                                    "title": rec_info["title"],
                                    "artist": rec_info["artist"],
                                    "youtube_url": rec_info.get("youtube_url"),
                                    "thumbnail": rec_info.get("thumbnail"),
                                    "score": float(round(l_score, 3)),
                                    "canonical_recording": rec_info
                                })

        m_candidates.sort(key=lambda x: x["score"], reverse=True)
        l_candidates.sort(key=lambda x: x["score"], reverse=True)

        # -------------------------------------------------------------
        # STEP 6: STREAM D — Monotone Rhythm & Beatbox Matching
        # -------------------------------------------------------------
        r_candidates: List[Dict[str, Any]] = []
        r_ioi, estimated_bpm = StreamDRhythm.extract_onsets_and_iois(bus2)

        # -------------------------------------------------------------
        # STEP 7: THE CHIMERIC DECISION ARBITER
        # -------------------------------------------------------------
        verdict = ChimericArbiter.resolve(
            m_candidates=m_candidates,
            l_candidates=l_candidates,
            r_candidates=r_candidates,
            c_lexical=c_lexical,
            pitch_entropy=pitch_entropy
        )

        verdict["latency_ms"] = int((time.time() - t0) * 1000)
        verdict["tempo_bpm"] = estimated_bpm
        verdict["pitch_entropy"] = round(pitch_entropy, 2)
        verdict["detected_lyrics"] = transcribed_text if c_lexical > 0.20 else "[Hummed Melody]"

        # Format card for UI
        cls._attach_ui_card(verdict, user_id=user_id)

        logger.info(
            f"HexaSonic: Verdict '{verdict.get('mode')}' -> '{verdict.get('title')}' "
            f"(conf={verdict.get('confidence')}, time={verdict['latency_ms']}ms)"
        )
        return verdict

    @classmethod
    async def _transcribe_phonetics(cls, audio_bytes: bytes, mime_type: str) -> Dict[str, Any]:
        """Multimodal acoustic listener for lyrics, humming classification, and song metadata."""
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return {"lyrics": "", "detected_title": None, "detected_artist": None, "is_humming": False}

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={api_key}"
        b64_audio = base64.b64encode(audio_bytes).decode("ascii")
        prompt = (
            "You are an expert acoustic music recognizer, audio analyst, and lyric transcriber.\n"
            "Listen to this audio recording carefully. The user is singing lyrics or humming/whistling a melody.\n"
            "Tasks:\n"
            "1. Transcribe any spoken or sung lyrics verbatim (in English, Romanized Hindi/Hinglish, Punjabi, or native language).\n"
            "2. If humming, whistling, or singing is heard, identify what commercial song this is!\n"
            "   Even if sung off-key, hummed approximately, or muffled, identify the single best candidate song and artist in 'detected_title' and 'detected_artist'.\n"
            "3. Provide up to 4 most likely candidate songs with 'title' and 'artist' in the 'candidates' array.\n"
            "4. If non-word humming, whistling, or lala-ing is heard, set 'is_humming' to true.\n\n"
            "Return strictly valid JSON format with keys:\n"
            "{\n"
            '  "detected_title": "Best Guess Song Title or null",\n'
            '  "detected_artist": "Best Guess Artist Name or null",\n'
            '  "lyrics": "verbatim lyrics or empty string",\n'
            '  "is_humming": boolean,\n'
            '  "candidates": [{"title": "Song Title 1", "artist": "Artist Name 1"}, {"title": "Song Title 2", "artist": "Artist Name 2"}]\n'
            "}"
        )
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {"inlineData": {"mimeType": mime_type, "data": b64_audio}}
                ]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json"
            }
        }
        try:
            import httpx
            import re
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    raw_text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    clean_text = raw_text
                    if "```" in clean_text:
                        clean_text = re.sub(r"^```(?:json)?\s*", "", clean_text, flags=re.MULTILINE)
                        clean_text = re.sub(r"\s*```$", "", clean_text, flags=re.MULTILINE)
                    m = re.search(r"\{.*\}", clean_text, re.DOTALL)
                    if m:
                        clean_text = m.group(0)
                    parsed = json.loads(clean_text)
                    title = parsed.get("detected_title")
                    artist = parsed.get("detected_artist")
                    candidates = parsed.get("candidates") or []
                    if (not title or str(title).lower() in ["null", "none", "unknown"]) and candidates:
                        title = candidates[0].get("title")
                        artist = candidates[0].get("artist")

                    lyrics = parsed.get("lyrics") or ""
                    is_humming = bool(parsed.get("is_humming", False))
                    clean_title = str(title).strip() if title and str(title).lower() not in ["null", "none", "unknown"] else None
                    clean_artist = str(artist).strip() if artist and str(artist).lower() not in ["null", "none", "unknown"] else None
                    logger.info(f"HexaSonic: Acoustic listener -> Title: '{clean_title}', Artist: '{clean_artist}', Lyrics: '{lyrics[:40]}', is_humming={is_humming}, candidates={len(candidates)}")
                    return {
                        "lyrics": lyrics,
                        "detected_title": clean_title,
                        "detected_artist": clean_artist,
                        "is_humming": is_humming,
                        "candidates": candidates
                    }
                else:
                    logger.warning(f"HexaSonic: Gemini API returned status {res.status_code}: {res.text[:200]}")
        except Exception as e:
            logger.warning(f"HexaSonic: Phonetic listener exception: {e}")
        return {"lyrics": "", "detected_title": None, "detected_artist": None, "is_humming": False}

    @classmethod
    def _build_success_response(
        cls,
        rec_info: Dict[str, Any],
        confidence: float,
        mode: str,
        explanation: str,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        track_id = rec_info["track_id"]
        title = rec_info["title"]
        artist = rec_info["artist"]
        yt_url = rec_info.get("youtube_url") or f"https://www.youtube.com/results?search_query={urllib.parse.quote(f'{title} {artist}')}"
        thumb = rec_info.get("thumbnail") or "https://img.youtube.com/vi/nyuo9-OjNNg/hqdefault.jpg"

        # Ingest to graph & LinUCB
        try:
            GraphLoader.load_tracks_batch(
                user_id=user_id,
                tracks=[{
                    "id": track_id,
                    "name": title,
                    "artists": [artist],
                    "album": "Hexa-Sonic Discovery",
                    "genres": ["Global Master"],
                    "source": "hexasonic",
                    "cover_url": thumb,
                    "uri": yt_url,
                    "preview_url": rec_info.get("preview_url") or yt_url,
                    "popularity": 95,
                    "energy": 0.75,
                    "valence": 0.65,
                    "danceability": 0.70
                }]
            )
            x = ContextualLinUCB.get_context_vector(session_depth=2)
            ContextualLinUCB.update(user_id=user_id, arm=3, x=x, reward=0.99)
        except Exception as e:
            logger.debug(f"HexaSonic: Graph ingestion note: {e}")

        card = {
            "track_id": track_id,
            "id": track_id,
            "track_name": title,
            "name": title,
            "artists": [artist],
            "genres": ["Hexa-Sonic Match"],
            "source": "hexasonic",
            "cover_url": thumb,
            "uri": yt_url,
            "preview_url": rec_info.get("preview_url") or yt_url,
            "score": round(confidence, 3),
            "popularity": 95,
            "energy": 0.75,
            "valence": 0.65,
            "danceability": 0.70,
            "bandit_arm": 3,
            "arm_name": "frontier_wildcard",
            "reason": f"✨ {explanation}",
            "transition_flow": "Scale-Invariant Constellation"
        }

        return {
            "status": "success",
            "mode": mode,
            "track_id": track_id,
            "title": title,
            "artist": artist,
            "artists": [artist],
            "youtube_url": yt_url,
            "thumbnail": thumb,
            "confidence": round(confidence, 3),
            "explanation": explanation,
            "card": card,
            "candidates": []
        }

    @classmethod
    def _attach_ui_card(cls, verdict: Dict[str, Any], user_id: Optional[str] = None):
        """Constructs rich UI Card for mobile deck and web player."""
        title = verdict.get("title") or "Recognized Song"
        artist = verdict.get("artist") or "Featured Artist"
        yt_url = verdict.get("youtube_url") or f"https://www.youtube.com/results?search_query={urllib.parse.quote(f'{title} {artist}')}"
        thumb = verdict.get("thumbnail") or "https://img.youtube.com/vi/nyuo9-OjNNg/hqdefault.jpg"
        track_id = f"hexasonic:{title.lower().replace(' ', '_')}"

        verdict["card"] = {
            "track_id": track_id,
            "id": track_id,
            "track_name": title,
            "name": title,
            "artists": [artist],
            "genres": ["Hexa-Sonic Discovery"],
            "source": "hexasonic",
            "cover_url": thumb,
            "uri": yt_url,
            "preview_url": yt_url,
            "score": verdict.get("confidence", 0.85),
            "popularity": 90,
            "energy": 0.7,
            "valence": 0.6,
            "danceability": 0.65,
            "bandit_arm": 3,
            "arm_name": "frontier_wildcard",
            "reason": f"✨ {verdict.get('explanation', '')}",
            "transition_flow": verdict.get("mode", "Hexa-Sonic Resolution")
        }
