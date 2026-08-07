import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes import router as matches_router
from backend.routes.formations import router as formations_router
from backend.routes.plays import router as plays_router
from backend.routes.team_phases import router as team_phases_router
from backend.routes.upload import router as upload_router
from backend.status import all_statuses, register_loop, write_status

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    register_loop(asyncio.get_running_loop())

    # On startup: any status file still saying "processing" is an orphan from a
    # previous server run — no thread is alive to finish it, so mark as "failed".
    # This unblocks query_duckdb (which skips reads while anything is "processing").
    orphans = [mid for mid, s in all_statuses().items() if s == "processing"]
    for match_id in orphans:
        logger.warning("Resetting orphaned processing status for match %s to failed", match_id)
        write_status(match_id, "failed")
    yield


app = FastAPI(
    title="WELS — Handball Analytics API",
    version="0.1.0",
    description="Backend API for handball match analysis, video ingestion, and action prediction.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(matches_router)
app.include_router(formations_router, prefix="/api/v1")
app.include_router(plays_router, prefix="/api/v1")
app.include_router(team_phases_router, prefix="/api/v1")
app.include_router(upload_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
