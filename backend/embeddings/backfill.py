import sys
from backend.core.neo4j_driver import neo4j_conn
from backend.embeddings.gemini_embedder import GeminiEmbedder

def run_backfill():
    print("Fetching tracks needing Gemini embeddings...")
    tracks = neo4j_conn.query("""
    MATCH (t:Track)
    WHERE t.embedding IS NULL
    RETURN t.id AS id, t.name AS name,
           [(t)-[:BY]->(a:Artist) | a.name] AS artists,
           [(t)-[:IN_GENRE]->(g:Genre) | g.name] AS genres,
           t.energy AS energy, t.valence AS valence, t.danceability AS danceability
    """)

    if not tracks:
        print("All tracks already have Gemini embeddings!")
        return

    print(f"Generating Gemini 768-dim vectors for {len(tracks)} tracks...")
    embeddings_map = GeminiEmbedder.embed_tracks_batch_sync(tracks)
    print(f"Successfully computed {len(embeddings_map)} Gemini vectors.")

    batch = [{"id": tid, "embedding": vec} for tid, vec in embeddings_map.items()]

    query = """
    UNWIND $batch AS row
    MATCH (t:Track {id: row.id})
    SET t.embedding = row.embedding
    RETURN count(t) AS updated
    """
    res = neo4j_conn.query(query, {"batch": batch})
    print(f"Successfully saved {res[0]['updated']} track embeddings to Neo4j Vector Index!")

if __name__ == "__main__":
    run_backfill()
