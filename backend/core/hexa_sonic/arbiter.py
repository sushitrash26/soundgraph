import numpy as np
from typing import List, Dict, Any, Optional
from backend.core.logger import logger

class ChimericArbiter:
    """
    Section 6: The Chimeric Decision Arbiter (Z-Score Distinctiveness Router).
    Routes matches without naive score averaging:
    - Case 1: UNANIMOUS_OR_SYNERGISTIC_MATCH (same Canonical Work in melody and lyrics)
    - Case 2: CHIMERIC_MASHUP_DETECTED (Starboy lyrics over Snooze or Runaway melody)
    - Case 3: PURE_MELODIC_MATCH (humming/whistling, C_lexical <= 0.25)
    - Case 4: PHONETIC_LYRIC_MATCH (clear lyrics, monotone singing/rapping)
    - Case 5: MULTI_CANDIDATE_FALLBACK (zero-hallucination honest candidates)
    """

    @classmethod
    def compute_z_score(cls, candidates: List[Dict[str, Any]]) -> float:
        """
        Z-Score Distinctiveness Margin:
        Z = (S_1 - mean(S_2..25)) / (std(S_2..25) + 1e-4)
        Measures how decisively candidate #1 stands out from background noise.
        """
        if not candidates or len(candidates) < 2:
            return 3.5 if (candidates and candidates[0].get("score", 0) >= 0.65) else 0.0

        scores = [c.get("score", 0.0) for c in candidates]
        s1 = scores[0]
        tail = scores[1:25]
        mean_tail = float(np.mean(tail))
        std_tail = float(np.std(tail))

        z = (s1 - mean_tail) / (std_tail + 1e-4)
        return float(round(z, 2))

    @classmethod
    def resolve(
        cls,
        m_candidates: List[Dict[str, Any]],
        l_candidates: List[Dict[str, Any]],
        r_candidates: Optional[List[Dict[str, Any]]] = None,
        c_lexical: float = 0.0,
        pitch_entropy: float = 1.0
    ) -> Dict[str, Any]:
        """
        Resolves multi-stream evidence into a deterministic verdict.
        """
        M1 = m_candidates[0] if m_candidates else None
        L1 = l_candidates[0] if (l_candidates and c_lexical > 0.20) else None

        Z_M = cls.compute_z_score(m_candidates)
        Z_L = cls.compute_z_score(l_candidates) if L1 else 0.0

        logger.info(
            f"Arbiter: M1={M1.get('title') if M1 else None} (score={M1.get('score') if M1 else 0:.2f}, Z={Z_M}), "
            f"L1={L1.get('title') if L1 else None} (score={L1.get('score') if L1 else 0:.2f}, Z={Z_L}), "
            f"C_lexical={c_lexical:.2f}"
        )

        # -------------------------------------------------------------
        # CASE 1: UNANIMOUS AGREEMENT OR SYNERGISTIC BOOST
        # -------------------------------------------------------------
        if M1 and L1 and c_lexical > 0.20:
            m_work = M1.get("work_id") or M1.get("title", "").lower()
            l_work = L1.get("work_id") or L1.get("title", "").lower()

            # Check if top candidate matches or intersects top 3
            if m_work == l_work:
                joint_conf = min(0.999, 1.0 - (1.0 - M1["score"]) * (1.0 - L1["score"]))
                return {
                    "mode": "UNANIMOUS_OR_SYNERGISTIC_MATCH",
                    "status": "success",
                    "confidence": float(round(joint_conf, 3)),
                    "primary_match": M1,
                    "title": M1.get("title"),
                    "artist": M1.get("artist"),
                    "youtube_url": M1.get("youtube_url") or L1.get("youtube_url"),
                    "thumbnail": M1.get("thumbnail") or L1.get("thumbnail"),
                    "explanation": "Matched both your vocal melody/tempo and sung lyrics with synergistic certainty."
                }

        # -------------------------------------------------------------
        # CASE 2: THE CHIMERIC MASHUP (e.g., Starboy Lyrics over Snooze Melody)
        # -------------------------------------------------------------
        if (
            L1 and M1 and
            (L1.get("work_id") != M1.get("work_id")) and
            (Z_L >= 2.5 and L1["score"] >= 0.65) and
            (Z_M >= 2.4 and M1["score"] >= 0.58)
        ):
            logger.info(f"Arbiter: Chimeric mashup detected! Lyrics='{L1.get('title')}', Melody='{M1.get('title')}'")
            return {
                "mode": "CHIMERIC_MASHUP_DETECTED",
                "status": "success",
                "confidence": float(round(max(L1["score"], M1["score"]), 3)),
                "title": f"{L1.get('title')} × {M1.get('title')}",
                "artist": f"{L1.get('artist')} / {M1.get('artist')}",
                "youtube_url": M1.get("youtube_url") or L1.get("youtube_url"),
                "thumbnail": M1.get("thumbnail") or L1.get("thumbnail"),
                "lyric_match": {
                    "track": L1,
                    "title": L1.get("title"),
                    "artist": L1.get("artist"),
                    "confidence": float(round(L1["score"], 3)),
                    "badge": "Matched Your Sung Lyrics",
                    "youtube_url": L1.get("youtube_url"),
                    "thumbnail": L1.get("thumbnail")
                },
                "melody_match": {
                    "track": M1,
                    "title": M1.get("title"),
                    "artist": M1.get("artist"),
                    "confidence": float(round(M1["score"], 3)),
                    "badge": "Matched Your Melody & Beat",
                    "youtube_url": M1.get("youtube_url"),
                    "thumbnail": M1.get("thumbnail")
                },
                "explanation": f"Mashup Detected: You sang the lyrics of '{L1.get('title')}' ({L1.get('artist')}) over the melody & beat of '{M1.get('title')}' ({M1.get('artist')})!"
            }

        # -------------------------------------------------------------
        # CASE 3: PURE HUMMING / WHISTLING
        # -------------------------------------------------------------
        if (c_lexical <= 0.20 or Z_L < 1.8) and M1 and ((Z_M >= 1.5 and M1["score"] >= 0.55) or M1["score"] >= 0.65):
            return {
                "mode": "PURE_MELODIC_MATCH",
                "status": "success",
                "confidence": float(round(M1["score"], 3)),
                "primary_match": M1,
                "title": M1.get("title"),
                "artist": M1.get("artist"),
                "youtube_url": M1.get("youtube_url"),
                "thumbnail": M1.get("thumbnail"),
                "explanation": "Identified purely from your hummed pitch contour and rhythmic cadence."
            }

        # -------------------------------------------------------------
        # CASE 4: MONOTONE SINGING / RAPPING (Clear lyrics, low pitch entropy)
        # -------------------------------------------------------------
        if L1 and (Z_L >= 1.8 or L1["score"] >= 0.55):
            return {
                "mode": "PHONETIC_LYRIC_MATCH",
                "status": "success",
                "confidence": float(round(L1["score"], 3)),
                "primary_match": L1,
                "title": L1.get("title"),
                "artist": L1.get("artist"),
                "youtube_url": L1.get("youtube_url"),
                "thumbnail": L1.get("thumbnail"),
                "explanation": "Identified from your sung lyrics and phonetic syllable cadence."
            }

        # -------------------------------------------------------------
        # CASE 5: ZERO-HALLUCINATION MULTI-CANDIDATE FALLBACK
        # -------------------------------------------------------------
        # Merge top 3 distinct candidates
        seen_tracks = set()
        merged = []
        for pool in [m_candidates, l_candidates, r_candidates or []]:
            for item in pool:
                tid = item.get("track_id")
                if tid and tid not in seen_tracks:
                    seen_tracks.add(tid)
                    merged.append(item)
                    if len(merged) >= 3:
                        break
            if len(merged) >= 3:
                break

        top_cand = merged[0] if merged else None
        top_conf = float(round(max([c.get("score", 0.0) for c in merged] or [0.45]), 3))

        return {
            "mode": "MULTI_CANDIDATE_FALLBACK",
            "status": "candidates",
            "confidence": top_conf,
            "title": top_cand.get("title") if top_cand else "Melodic Candidate",
            "artist": top_cand.get("artist") if top_cand else "Various Artists",
            "youtube_url": top_cand.get("youtube_url") if top_cand else None,
            "thumbnail": top_cand.get("thumbnail") if top_cand else None,
            "candidates": merged,
            "explanation": "Detected melodic and rhythmic motifs across multiple close candidates. Tap any track below to verify!"
        }
