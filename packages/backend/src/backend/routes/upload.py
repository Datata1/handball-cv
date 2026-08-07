import logging
import os
import shutil
import subprocess
import sys
import threading
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from backend.status import write_status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["api"])

# Configure paths - absolute paths from monorepo root
# upload.py is at: packages/backend/src/backend/routes/upload.py
# Need 6 parents to get to monorepo root: routes -> backend -> src -> backend -> packages -> root
MONOREPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent.parent
DATA_INPUT_VIDEOS = MONOREPO_ROOT / "data" / "input" / "videos"
DATA_OUTPUT_VIDEOS = MONOREPO_ROOT / "data" / "output" / "videos"


def _run_subprocess(cmd: list[str], cwd: str, label: str) -> bool:
    """Run a subprocess, stream its output to the logger, return True on success."""
    env = os.environ.copy()
    env.pop("VIRTUAL_ENV", None)
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        encoding="utf-8",
        errors="replace",
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        logger.info("[%s] %s", label, line.rstrip())
    return proc.wait() == 0


def run_ingestion_pipeline(match_id: str, video_path: str, annotate_video: bool = False) -> None:
    """Run wels-ingest then wels-score in a background thread.

    The status is set to 'done' only after both steps succeed so the frontend
    shows a match as ready only when formation data is already available.

    The annotated debug video is skipped unless annotate_video is True — the
    per-frame drawing + H.264 encode is the most CPU-expensive part of ingestion.
    """
    uv_exe = shutil.which("uv") or "uv"

    # ── Step 1: ingestion ────────────────────────────────────────────────────
    ingest_cmd = [
        uv_exe,
        "run",
        "--extra",
        "cv",
        "wels-ingest",
        video_path,
        match_id,
        # Inference resolution — bigger = more accurate on distant players, slower.
        # Tunable via WELS_DETECTION_IMGSZ (640 fast / 960 balanced / 1280 high quality).
        "--imgsz",
        os.environ.get("WELS_DETECTION_IMGSZ", "640"),
    ]
    if annotate_video:
        DATA_OUTPUT_VIDEOS.mkdir(parents=True, exist_ok=True)
        output_video = DATA_OUTPUT_VIDEOS / f"{match_id}_annotated.mp4"
        ingest_cmd += ["--output-video", str(output_video)]
    if sys.platform in ("darwin", "win32"):
        ingest_cmd += ["--device", "cpu"]

    try:
        ok = _run_subprocess(
            ingest_cmd, str(MONOREPO_ROOT / "packages" / "ingestion"), f"ingest {match_id}"
        )
        if not ok:
            logger.error("Ingestion failed for %s", match_id)
            write_status(match_id, "failed")
            return
    except Exception as e:
        logger.error("Error running ingestion for %s: %s", match_id, e)
        write_status(match_id, "failed")
        return

    # ── Step 2: scoring (formations + possession) ────────────────────────────
    score_cmd = [uv_exe, "run", "wels-score", match_id]
    try:
        ok = _run_subprocess(score_cmd, str(MONOREPO_ROOT / "packages" / "ml"), f"score {match_id}")
        if not ok:
            logger.warning("Scoring failed for %s — match still marked done", match_id)
    except Exception as e:
        logger.warning("Error running scoring for %s: %s — match still marked done", match_id, e)

    write_status(match_id, "done")


# Module-level singletons for FastAPI parameter defaults
_file_default = File()
_annotate_video_default = Form(False)


@router.post("/videos/upload")
async def upload_video(
    file: UploadFile = _file_default,
    annotate_video: bool = _annotate_video_default,
) -> JSONResponse:
    """Upload a video file to the input videos directory and start processing."""
    # Ensure directory exists
    DATA_INPUT_VIDEOS.mkdir(parents=True, exist_ok=True)

    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    file_ext = file.filename.split(".")[-1].lower()
    if file_ext not in ["mp4", "avi", "mov", "mkv"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format: {file_ext}. Supported: mp4, avi, mov, mkv",
        )

    # Generate unique match_id and save file
    match_id = str(uuid.uuid4())[:8]
    safe_filename = f"{match_id}_{file.filename}"
    file_path = DATA_INPUT_VIDEOS / safe_filename

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Mark as processing before spawning the worker thread
    write_status(match_id, "processing")

    # Start ingestion pipeline in a background thread
    thread = threading.Thread(
        target=run_ingestion_pipeline, args=(match_id, str(file_path), annotate_video)
    )
    thread.start()

    return JSONResponse(
        content={
            "match_id": match_id,
            "filename": safe_filename,
            "status": "processing",
            "message": "Video uploaded successfully. Processing has started.",
        }
    )


@router.get("/videos/{match_id}/output")
async def get_output_video(match_id: str) -> JSONResponse:
    """Get the output video status for a match, based on the status file."""
    from backend.status import read_status

    status = read_status(match_id)
    output_video = DATA_OUTPUT_VIDEOS / f"{match_id}_annotated.mp4"

    if status == "done" and output_video.exists():
        return JSONResponse(
            content={
                "match_id": match_id,
                "video_path": str(output_video),
                "status": "ready",
            }
        )

    # Map status file values to API response values
    api_status = "processing" if status == "processing" else status
    return JSONResponse(
        content={
            "match_id": match_id,
            "video_path": None,
            "status": api_status,
        }
    )


@router.get("/videos/{match_id}/output/video")
async def stream_output_video(match_id: str):
    """Stream the annotated output video file."""
    from fastapi.responses import FileResponse

    annotated = DATA_OUTPUT_VIDEOS / f"{match_id}_annotated.mp4"
    if annotated.exists():
        return FileResponse(
            path=str(annotated), media_type="video/mp4", filename=f"{match_id}_annotated.mp4"
        )

    raise HTTPException(status_code=404, detail="Output video not found")
