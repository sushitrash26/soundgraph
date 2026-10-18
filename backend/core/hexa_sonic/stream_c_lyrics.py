import re
from typing import List, Dict, Any, Tuple, Optional
import rapidfuzz
from rapidfuzz import fuzz
from backend.core.logger import logger

class StreamCLyrics:
    """
    Section 4 Stream C: Phonetic & Vowel-Skeleton Lyric Engine (The Mumble Fix).
    Blind to melody, tempo, and key.
    1. Extracts Consonant-Class + Vowel Skeleton:
       Plosives (p, b, t, d, k, g) -> 'P'
       Nasals (m, n, ng) -> 'N'
       Fricatives (s, z, f, v, sh, th, ch, j) -> 'F'
       Liquids/Glides (l, r, w, y) -> 'L'
       Preserves vowel skeletons (a, e, i, o, u)
    2. Gating Parameter C_lexical:
       If speech is repetitive humming ('mmm', 'na-na', 'la-la'), C_lexical -> 0.0.
       Stream C is muted to prevent hallucination!
    3. RapidFuzz Normalized Phonetic Levenshtein Matching against catalog lyrics.
    """

    HUM_SYLLABLES = {"m", "mm", "mmm", "hmm", "hm", "la", "na", "da", "ba", "ah", "oh", "uh", "ooh", "hoo"}

    CONSONANT_MAP = {
        'p': 'P', 'b': 'P', 't': 'P', 'd': 'P', 'k': 'P', 'g': 'P',
        'm': 'N', 'n': 'N',
        's': 'F', 'z': 'F', 'f': 'F', 'v': 'F', 'sh': 'F', 'th': 'F', 'ch': 'F', 'j': 'F',
        'l': 'L', 'r': 'L', 'w': 'L', 'y': 'L'
    }

    @classmethod
    def compute_consonant_vowel_skeleton(cls, text: str) -> str:
        """
        Converts text/lyrics to an acoustic consonant-class and vowel skeleton.
        Tolerates imperfect diction, slurring, accents, and mumbling.
        """
        if not text:
            return ""
        clean = re.sub(r'[^a-zA-Z\s]', '', text.lower()).strip()
        words = clean.split()
        skel_words = []

        for w in words:
            skel = []
            i = 0
            while i < len(w):
                # Two-letter digraphs
                if i + 1 < len(w) and w[i : i + 2] in ['sh', 'th', 'ch', 'ng']:
                    c = w[i : i + 2]
                    skel.append('N' if c == 'ng' else 'F')
                    i += 2
                    continue

                char = w[i]
                if char in 'aeiou':
                    skel.append(char)
                elif char in cls.CONSONANT_MAP:
                    skel.append(cls.CONSONANT_MAP[char])
                else:
                    skel.append(char.upper())
                i += 1
            skel_words.append("".join(skel))

        return " ".join(skel_words)

    @classmethod
    def compute_lexical_diversity_gate(cls, transcribed_text: str) -> float:
        """
        Computes C_lexical in [0.0, 1.0].
        If words are repetitive humming syllables, returns 0.0 (Pure Humming).
        """
        if not transcribed_text or len(transcribed_text.strip()) < 3:
            return 0.0

        clean = re.sub(r'[^a-zA-Z\s]', '', transcribed_text.lower()).strip()
        tokens = clean.split()
        if not tokens:
            return 0.0

        hum_count = sum(1 for t in tokens if t in cls.HUM_SYLLABLES or re.match(r'^[mn]+$', t))
        hum_ratio = hum_count / float(len(tokens))

        if hum_ratio >= 0.70:
            logger.info(f"StreamC: Gating closed (C_lexical=0.0) due to hum ratio {hum_ratio:.2f}")
            return 0.0

        # Unique token ratio
        unique_ratio = len(set(tokens)) / float(len(tokens))
        c_lexical = min(1.0, (1.0 - hum_ratio) * (0.5 + 0.5 * unique_ratio))
        return float(round(c_lexical, 3))

    @classmethod
    def match_lyrics_against_index(
        cls,
        query_text: str,
        catalog_lyrics: List[Tuple[str, str, str]]
    ) -> List[Dict[str, Any]]:
        """
        Matches query lyrics against catalog lyrics.
        catalog_lyrics: [(track_id, plain_lyrics, phonetic_skeleton), ...]
        Returns top candidates sorted by S_lyric in [0.0, 1.0].
        """
        if not query_text or not catalog_lyrics:
            return []

        c_lex = cls.compute_lexical_diversity_gate(query_text)
        if c_lex <= 0.20:
            return []

        q_clean = query_text.lower().strip()
        q_skel = cls.compute_consonant_vowel_skeleton(query_text)

        candidates = []
        for track_id, plain, cat_skel in catalog_lyrics:
            # 1. Phonetic skeleton partial ratio
            skel_score = fuzz.partial_ratio(q_skel, cat_skel) / 100.0

            # 2. Token set ratio on plain text
            plain_score = fuzz.token_set_ratio(q_clean, plain.lower()) / 100.0

            # Combined acoustic phonetic score
            s_lyric = max(skel_score * 0.7 + plain_score * 0.3, plain_score)

            if s_lyric >= 0.35:
                candidates.append({
                    "track_id": track_id,
                    "score": float(round(s_lyric, 3)),
                    "c_lexical": c_lex,
                    "matched_query": query_text
                })

        candidates.sort(key=lambda x: x["score"], reverse=True)
        return candidates[:25]

    @classmethod
    def match_single(cls, query_text: str, candidate_lyrics: str) -> float:
        """Computes rapid phonetic + token similarity between query and candidate lyrics."""
        if not query_text or not candidate_lyrics:
            return 0.0
        q_clean = query_text.lower().strip()
        q_skel = cls.compute_consonant_vowel_skeleton(query_text)
        cat_skel = cls.compute_consonant_vowel_skeleton(candidate_lyrics)
        skel_score = fuzz.partial_ratio(q_skel, cat_skel) / 100.0
        plain_score = fuzz.token_set_ratio(q_clean, candidate_lyrics.lower()) / 100.0
        return float(round(max(skel_score * 0.7 + plain_score * 0.3, plain_score), 3))

