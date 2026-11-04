import os
import uuid
import time
import shutil
import asyncio
from typing import Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse
from backend.core.logger import logger
from backend.models.audio_forge import (
    AudioStemManifest,
    StemSeparationJob,
    StemTransformRequest,
    StemTransformResponse,
    RemixExportRequest,
    RemixExportResponse
)
from backend.services.audio_forge.audio_analyzer import AudioAnalyzer
from backend.services.audio_forge.stem_separator import StemSeparator
from backend.services.audio_forge.multimodal_embedder import MultimodalAudioEmbedder
from backend.services.audio_forge.stem_transformer import StemTransformer
from backend.services.audio_forge.remix_mixer import RemixMixer

router = APIRouter(prefix="/audio", tags=["Audio Forge & Stem Remix"])

BASE_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
UPLOADS_DIR = os.path.join(BASE_DATA_DIR, "uploads")
STEMS_DIR = os.path.join(BASE_DATA_DIR, "stems")
REMIXES_DIR = os.path.join(BASE_DATA_DIR, "remixes")

os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(STEMS_DIR, exist_ok=True)
os.makedirs(REMIXES_DIR, exist_ok=True)

# In-memory job state repository
JOB_STORE: Dict[str, StemSeparationJob] = {}

@router.post("/analyze", response_model=AudioStemManifest)
async def analyze_audio_track(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None)
):
    """
    Phase 1: Gemini 1.5 Flash Audio Fingerprinting.
    Uploads audio track (MP3/WAV <= 25MB) and extracts dynamic, non-hardcoded stem manifest.
    """
    # Validate file extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in [".mp3", ".wav", ".m4a", ".aac", ".ogg"]:
        raise HTTPException(status_code=400, detail="Unsupported audio format. Use MP3 or WAV.")

    job_id = f"job_{uuid.uuid4().hex[:10]}"
    job_dir = os.path.join(UPLOADS_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)
    
    file_path = os.path.join(job_dir, f"source{ext}")
    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file exceeds 25MB limit.")

    with open(file_path, "wb") as f:
        f.write(content)

    mime_type = "audio/wav" if ext == ".wav" else "audio/mp3"
    manifest = await AudioAnalyzer.analyze_audio(file_path, mime_type=mime_type)
    manifest.job_id = job_id

    # Initialize job in store
    job = StemSeparationJob(
        job_id=job_id,
        status="analyzed",
        progress_percent=25,
        song_title=manifest.song_title,
        source_file=file_path,
        manifest=manifest,
        created_at=time.time()
    )
    JOB_STORE[job_id] = job
    return manifest

def _run_separation_task(job_id: str, file_path: str, user_id: Optional[str]):
    """Background runner for CPU stem separation, de-bleeding, and graph embedding."""
    job = JOB_STORE.get(job_id)
    if not job:
        return

    try:
        job.status = "separating"
        job.progress_percent = 40
        out_dir = os.path.join(STEMS_DIR, job_id)
        os.makedirs(out_dir, exist_ok=True)

        stems = StemSeparator.separate_stems(file_path, out_dir, manifest=job.manifest)
        job.stems = stems
        job.progress_percent = 80

        # Persist stems into Neo4j with multimodal embeddings
        for stem in stems:
            if stem.file_path and os.path.exists(stem.file_path):
                try:
                    with open(stem.file_path, "rb") as f:
                        audio_b = f.read(1024 * 512)  # sample bytes
                    MultimodalAudioEmbedder.save_stem_to_graph(stem, job_id=job_id, user_id=user_id)
                except Exception as e:
                    logger.warning(f"Error saving stem {stem.stem_id} to graph: {e}")

        job.status = "completed"
        job.progress_percent = 100
        job.completed_at = time.time()
        logger.info(f"Audio Forge: Separation job {job_id} successfully completed.")
    except Exception as e:
        logger.error(f"Audio Forge: Separation job {job_id} failed: {e}")
        job.status = "failed"
        job.error_message = str(e)

@router.post("/separate/{job_id}", response_model=StemSeparationJob)
async def trigger_stem_separation(
    job_id: str,
    background_tasks: BackgroundTasks,
    user_id: Optional[str] = Query(None),
    wait: bool = Query(True, description="If true (default), buffers and waits until separation finishes so all stems are returned in the response immediately"),
    timeout_sec: int = Query(60, description="Max seconds to wait before returning queued status")
):
    """
    Phase 2: Triggers Demucs/HPSS CPU stem separation with adaptive -45dB noise gate.
    If wait=True (default), buffers and waits until the job completes so all isolated stems are returned immediately.
    """
    job = JOB_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found. Analyze audio first.")

    if job.status == "completed":
        return job

    # If already running
    if job.status == "separating":
        if wait:
            start_t = time.time()
            while job.status == "separating" and (time.time() - start_t) < timeout_sec:
                await asyncio.sleep(0.3)
        return job

    # Launch separation in thread pool immediately so it runs concurrently without blocking
    job.status = "separating"
    task = asyncio.create_task(asyncio.to_thread(_run_separation_task, job_id, job.source_file, user_id))

    # If wait requested (default), wait for thread task to complete or timeout
    if wait:
        try:
            await asyncio.wait_for(task, timeout=float(timeout_sec))
        except asyncio.TimeoutError:
            logger.info(f"Separation job {job_id} still processing in background after {timeout_sec}s")
            return job

        if job.status == "failed":
            raise HTTPException(status_code=500, detail=f"Stem separation failed: {job.error_message}")

    return job

@router.get("/job/{job_id}/status", response_model=StemSeparationJob)
async def get_job_status(
    job_id: str,
    wait_until_ready: bool = Query(False, description="If true, wait until separation is completed"),
    timeout_sec: int = Query(30)
):
    """
    Polls status of ongoing stem separation.
    Optionally set wait_until_ready=True to buffer until separation completes.
    """
    job = JOB_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job ID not found.")

    if wait_until_ready and job.status in ["pending", "analyzed", "queued", "separating"]:
        start_t = time.time()
        while job.status in ["pending", "analyzed", "queued", "separating"] and (time.time() - start_t) < timeout_sec:
            await asyncio.sleep(0.4)

    return job

@router.post("/stem/transform", response_model=StemTransformResponse)
async def transform_stem(req: StemTransformRequest):
    """
    Phase 4: DSP Stem Transformation Engine.
    Transforms an individual stem based on user taste centroid or natural language prompt.
    """
    # Check if the requested stem belongs to an in-progress separation job
    for jid, job in JOB_STORE.items():
        if job.status in ["queued", "separating"]:
            stem_in_job = (
                (job.manifest and any(s.stem_id == req.stem_id for s in job.manifest.detected_instruments))
                or any(s.stem_id == req.stem_id for s in job.stems)
            )
            if stem_in_job:
                raise HTTPException(
                    status_code=409,
                    detail=f"Stems for job '{jid}' are currently separating ({job.progress_percent}%). Please wait a few seconds before transforming."
                )

    # Locate stem in completed storage
    stem_file = None
    target_job_id = None
    instrument = "other"
    available_stems = []

    for jid, job in JOB_STORE.items():
        for s in job.stems:
            available_stems.append(s.stem_id)
            if s.stem_id == req.stem_id:
                stem_file = s.file_path
                target_job_id = jid
                instrument = s.instrument
                break
        if stem_file:
            break

    if not stem_file or not os.path.exists(stem_file):
        raise HTTPException(
            status_code=404,
            detail=f"Stem '{req.stem_id}' not found. Available stems: {available_stems or 'None. Run POST /audio/separate first.'}"
        )

    out_id = f"{req.stem_id}_tx_{int(time.time())}"
    out_path = os.path.join(STEMS_DIR, target_job_id, f"{out_id}.wav")

    res = await StemTransformer.transform_stem(
        stem_path=stem_file,
        output_path=out_path,
        mode=req.mode,
        user_id=req.user_id,
        prompt=req.prompt,
        instrument=instrument
    )
    return res

@router.post("/remix/export", response_model=RemixExportResponse)
async def export_master_remix(req: RemixExportRequest):
    """
    Phase 5: Combines stems with faders, pans, mute/solo and exports normalized master.
    """
    job = JOB_STORE.get(req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{req.job_id}' not found.")

    if job.status in ["queued", "separating"]:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot export remix: Job '{req.job_id}' is still separating stems ({job.progress_percent}%). Please wait."
        )

    if job.status == "failed":
        raise HTTPException(
            status_code=500,
            detail=f"Cannot export remix: Stem separation failed with error: {job.error_message}"
        )

    if not job.stems:
        raise HTTPException(
            status_code=400,
            detail=f"Job '{req.job_id}' has no separated stems available to mix. Run POST /audio/separate/{req.job_id} first."
        )

    stem_paths = {s.stem_id: s.file_path for s in job.stems if s.file_path}
    out_name = f"remix_{req.job_id}_{int(time.time())}.wav"
    out_file = os.path.join(REMIXES_DIR, out_name)

    res = RemixMixer.mix_and_export(
        stems=req.stems,
        stem_paths=stem_paths,
        output_file_path=out_file,
        master_gain_db=req.master_gain_db,
        remix_title=req.remix_title
    )
    return res

@router.get("/stream/{job_id}/{stem_id}")
async def stream_audio_stem(job_id: str, stem_id: str):
    """Streams stem audio bytes for mobile preview player."""
    job_dir = os.path.join(STEMS_DIR, job_id)
    candidates = [
        os.path.join(job_dir, f"{stem_id}.wav"),
        os.path.join(job_dir, f"{stem_id.replace('stem_', '')}.wav")
    ]
    for c in candidates:
        if os.path.exists(c):
            return FileResponse(c, media_type="audio/wav")

    raise HTTPException(status_code=404, detail="Stem audio file not found on disk.")

@router.get("/search/stems")
async def search_stems_cross_modal(q: str = Query(..., min_length=2), limit: int = 10):
    """
    Phase 3: Cross-modal text-to-audio search over Neo4j Stem knowledge graph.
    """
    query_vec = await MultimodalAudioEmbedder.embed_text_query(q)
    results = MultimodalAudioEmbedder.search_stems_cross_modal(query_vec, limit=limit)
    return {"query": q, "count": len(results), "matches": results}
