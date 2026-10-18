import asyncio
from backend.core.logger import logger
from backend.core.hexa_sonic.jit_hydration import JITHydrationWorker
from backend.core.hexa_sonic.canonical_store import CanonicalStore

BENCHMARK_TRACKS = [
    ("Starboy", "The Weeknd"),
    ("Snooze", "SZA"),
    ("Runaway", "Kanye West"),
    ("Tum Hi Ho", "Arijit Singh"),
    ("Tere Bina", "A.R. Rahman")
]

async def seed():
    logger.info("HexaSonic: Seeding benchmark tracks into CanonicalStore...")
    for title, artist in BENCHMARK_TRACKS:
        try:
            # 1. Fetch preview stream
            prev = await JITHydrationWorker.fetch_preview_audio_url(title, artist)
            if not prev:
                logger.warning(f"Seed: Could not find preview for {title} by {artist}")
                continue

            # 2. Fetch lyrics from LRCLIB
            lyrics_list = await JITHydrationWorker.query_lrclib_lyrics(f"{title} {artist}", limit=1)
            lyrics = lyrics_list[0]["lyrics"] if lyrics_list else ""

            # 3. Hydrate & Index
            res = await JITHydrationWorker.hydrate_track_from_preview(
                title=prev["title"],
                artist=prev["artist"],
                preview_url=prev["preview_url"],
                lyrics=lyrics,
                artwork_url=prev.get("artwork_url")
            )
            if res:
                print(f"✓ Indexed: {prev['title']} by {prev['artist']}")
        except Exception as e:
            logger.warning(f"Seed: Error hydrating {title}: {e}")

    # Verify FAISS
    faiss_idx = CanonicalStore.get_faiss_index()
    print(f"\nSeeding complete! FAISS total indexed vectors: {faiss_idx.ntotal}")

if __name__ == "__main__":
    asyncio.run(seed())
