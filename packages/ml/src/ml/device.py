"""Device auto-detection for the ML package (training + scoring).

Turns a *requested* device string ("auto", "cuda", "cpu") into a *concrete*
one. Callers ask for "auto" (the default) and get a CUDA GPU when one is
visible, CPU otherwise — no manual configuration. Explicitly requesting "cuda"
on a machine without a GPU degrades to "cpu" with a warning rather than
crashing torch.
"""

from __future__ import annotations

import logging

import torch

logger = logging.getLogger(__name__)


def resolve_device(requested: str) -> torch.device:
    """Resolve a requested device string to a concrete ``torch.device``.

    "auto"  → cuda if a CUDA GPU is available, else cpu
    "cuda"  → cuda if available, else cpu (logs a warning)
    "cpu"   → cpu
    other   → passed straight to ``torch.device`` (e.g. "mps", "cuda:1")
    """
    requested = (requested or "auto").strip().lower()

    if requested == "cpu":
        return torch.device("cpu")

    if requested in ("auto", "cuda"):
        if torch.cuda.is_available():
            return torch.device("cuda")
        if requested == "cuda":
            logger.warning("CUDA requested but not available; falling back to CPU")
        else:
            logger.info("No CUDA GPU detected; using cpu")
        return torch.device("cpu")

    return torch.device(requested)
