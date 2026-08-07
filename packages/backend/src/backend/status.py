"""Pipeline status tracking via simple text files on disk.

Each match gets a file at ``data/output/status/<match_id>.status`` containing one
of: ``processing``, ``done``, ``failed``.  This is the single source of truth for
pipeline state — independent of DuckDB (which is locked while the pipeline runs).

SSE pub/sub
-----------
``register_loop`` must be called once from the FastAPI lifespan with the running
event loop.  ``write_status`` then notifies all active SSE subscribers via
``loop.call_soon_threadsafe`` so the background ingestion thread can safely push
events to async consumers.
"""

import asyncio
import threading
from pathlib import Path
from typing import Literal

type PipelineStatus = Literal["processing", "done", "failed", "unknown"]

# Resolve monorepo root the same way upload.py does
_MONOREPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
STATUS_DIR = _MONOREPO_ROOT / "data" / "output" / "status"

# ── SSE event bus ─────────────────────────────────────────────────────────────
_loop: asyncio.AbstractEventLoop | None = None
_subscribers: set[asyncio.Queue[dict[str, object]]] = set()
_lock = threading.Lock()


def register_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def subscribe() -> asyncio.Queue[dict[str, object]]:
    q: asyncio.Queue[dict[str, object]] = asyncio.Queue()
    with _lock:
        _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue[dict[str, object]]) -> None:
    with _lock:
        _subscribers.discard(q)


def _notify(match_id: str, status: PipelineStatus) -> None:
    if _loop is None:
        return
    event = {"match_id": match_id, "status": status}
    with _lock:
        subs = list(_subscribers)
    for q in subs:
        _loop.call_soon_threadsafe(q.put_nowait, event)


def write_status(match_id: str, status: PipelineStatus) -> None:
    """Persist *status* for *match_id* to disk and notify SSE subscribers."""
    STATUS_DIR.mkdir(parents=True, exist_ok=True)
    (STATUS_DIR / f"{match_id}.status").write_text(status)
    _notify(match_id, status)


def read_status(match_id: str) -> PipelineStatus:
    """Return the current pipeline status for *match_id*."""
    path = STATUS_DIR / f"{match_id}.status"
    if not path.exists():
        return "unknown"
    text = path.read_text().strip()
    if text == "processing":
        return "processing"
    if text == "done":
        return "done"
    if text == "failed":
        return "failed"
    return "unknown"


def all_statuses() -> dict[str, PipelineStatus]:
    """Return ``{match_id: status}`` for every status file on disk."""
    if not STATUS_DIR.exists():
        return {}
    result: dict[str, PipelineStatus] = {}
    for p in STATUS_DIR.glob("*.status"):
        match_id = p.stem
        result[match_id] = read_status(match_id)
    return result
