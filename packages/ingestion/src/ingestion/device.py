"""Device auto-detection for the ingestion pipeline.

A single place that turns a *requested* device string ("auto", "cuda", "cpu")
into a *concrete* one the rest of the pipeline can pass straight to YOLO/torch.

The pipeline never has to know whether a GPU is present: callers ask for
"auto" (the default) and get "cuda" when a CUDA GPU is visible, "cpu"
otherwise. Explicitly requesting "cuda" on a machine without a GPU degrades
gracefully to "cpu" with a warning instead of crashing mid-run.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def resolve_device(requested: str) -> str:
    """Resolve a requested device string to a concrete torch device.

    "auto"  → "cuda" if a CUDA GPU is available, else "cpu"
    "cuda"  → "cuda" if available, else "cpu" (logs a warning)
    "cpu"   → "cpu"
    other   → returned unchanged (e.g. "mps", "cuda:1")
    """
    requested = (requested or "auto").strip().lower()

    if requested == "cpu":
        return "cpu"

    try:
        import torch
    except ImportError:
        if requested != "auto":
            logger.warning("Torch is not installed; falling back from %r to CPU", requested)
        return "cpu"

    if torch.cuda.is_available():
        if requested == "auto":
            logger.info("CUDA GPU detected; using cuda")
        return "cuda"

    if requested == "cuda":
        logger.warning("CUDA requested but not available; falling back to CPU")
    else:
        logger.info("No CUDA GPU detected; using cpu")
    return "cpu"


def yolo_precision_kwargs(half: bool) -> dict[str, object]:
    """Return the YOLO predict/track keyword for FP16 inference, matching the
    installed ultralytics API.
    """
    if not half:
        return {}
    try:
        import ultralytics

        major, minor = (int(part) for part in ultralytics.__version__.split(".")[:2])
        if (major, minor) >= (8, 4):
            return {"quantize": 16}
    except (ImportError, ValueError, AttributeError):
        pass
    return {"half": True}
