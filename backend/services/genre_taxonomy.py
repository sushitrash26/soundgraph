"""
Canonical Genre Taxonomy and Dealbreaker Resolver (Workstream W12).
Maps specific sub-genres and micro-tags into canonical genre families so dealbreakers
(e.g., AVOIDS 'metal') reliably exclude all child sub-genres like 'metalcore', 'death metal', etc.
"""

from typing import Dict, List, Set, Optional

# Canonical Genre Hierarchy Mapping
GENRE_FAMILY_MAP: Dict[str, str] = {
    # Metal family
    "metal": "metal",
    "heavy metal": "metal",
    "death metal": "metal",
    "black metal": "metal",
    "metalcore": "metal",
    "thrash metal": "metal",
    "nu metal": "metal",
    "doom metal": "metal",
    "power metal": "metal",
    
    # Electronic family
    "electronic": "electronic",
    "edm": "electronic",
    "house": "electronic",
    "techno": "electronic",
    "synthwave": "electronic",
    "dubstep": "electronic",
    "drum and bass": "electronic",
    "trance": "electronic",
    "ambient": "electronic",
    "electro pop": "electronic",

    # Hip Hop & Rap
    "hip hop": "hip hop",
    "rap": "hip hop",
    "trap": "hip hop",
    "drill": "hip hop",
    "boom bap": "hip hop",
    "gangsta rap": "hip hop",
    "lo-fi hip hop": "hip hop",
    "desi hip hop": "hip hop",

    # Rock & Alternative
    "rock": "rock",
    "classic rock": "rock",
    "hard rock": "rock",
    "punk rock": "rock",
    "indie rock": "indie",
    "alternative rock": "rock",
    "grunge": "rock",
    "psychedelic rock": "rock",

    # Indie & Folk
    "indie": "indie",
    "indie pop": "indie",
    "bedroom pop": "indie",
    "folk": "folk",
    "acoustic": "folk",
    "singer-songwriter": "folk",
    "bluegrass": "folk",

    # Pop & R&B
    "pop": "pop",
    "dance pop": "pop",
    "synthpop": "pop",
    "teen pop": "pop",
    "k-pop": "pop",
    "r&b": "r&b",
    "contemporary r&b": "r&b",
    "soul": "r&b",
    "neo-soul": "r&b",

    # South Asian / Regional
    "bollywood": "south asian",
    "punjabi": "south asian",
    "sufi": "south asian",
    "ghazal": "south asian",
    "bhangra": "south asian"
}


class GenreTaxonomy:
    """Resolves genre families and checks dealbreakers."""

    @classmethod
    def get_canonical_family(cls, genre_name: str) -> str:
        """Returns the parent canonical family for any sub-genre."""
        clean = genre_name.strip().lower()
        if clean in GENRE_FAMILY_MAP:
            return GENRE_FAMILY_MAP[clean]
        for key, family in GENRE_FAMILY_MAP.items():
            if key in clean:
                return family
        return clean

    @classmethod
    def is_dealbreaker(cls, track_genres: List[str], avoided_genres: Set[str]) -> bool:
        """
        Returns True if any track genre matches an avoided genre or its parent family.
        """
        if not track_genres or not avoided_genres:
            return False

        clean_avoided = {cls.get_canonical_family(a) for a in avoided_genres}

        for g in track_genres:
            clean_g = g.strip().lower()
            family = cls.get_canonical_family(clean_g)
            if clean_g in clean_avoided or family in clean_avoided:
                return True

        return False
