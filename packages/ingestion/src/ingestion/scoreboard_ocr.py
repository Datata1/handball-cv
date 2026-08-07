"""
OCR-based extraction of game time and score from the video scoreboard.

Crops a configurable ROI from the frame, preprocesses it for Tesseract,
and parses game time (MM:SS) and home/away scores with regex.

Requires pytesseract (Python wrapper) and the Tesseract system binary.
Install both before use:
    uv sync --all-extras          # installs pytesseract Python package
    # system: apt install tesseract-ocr  /  brew install tesseract  /  winget install UB-Mannheim.TesseractOCR
"""

from __future__ import annotations

import logging
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Legacy ROI constants — used as fallback when auto-detection fails.
# Calibrated to the top-right scoreboard bar of 1080p broadcast footage
# ("TVB 27 THW 21 51:49"): the box spans both team+score cells AND the clock so
# the leading score digit is never clipped. Run scripts/calibrate_roi.py on a
# real frame to re-calibrate for a differently positioned overlay.
# ---------------------------------------------------------------------------
ROI_X: int = 1344
ROI_Y: int = 21
ROI_WIDTH: int = 576
ROI_HEIGHT: int = 86

# ---------------------------------------------------------------------------
# Relative ROI candidates for auto-detection.
# Each entry: (x_rel, y_rel, w_rel, h_rel) as fractions of frame dimensions.
# Covers the four corners where scoreboards typically appear. Boxes are 30% wide
# so they span the *whole* bar (team + score + clock); a narrower box starting
# further into the corner clipped the leading digit of the home score (27 → 7).
# Checked in order; the first plausible match wins.
# ---------------------------------------------------------------------------
_ROI_CANDIDATES: list[tuple[float, float, float, float]] = [
    (0.70, 0.02, 0.30, 0.08),  # top-right
    (0.00, 0.02, 0.30, 0.08),  # top-left
    (0.70, 0.83, 0.30, 0.14),  # bottom-right  (taller to catch low scoreboards)
    (0.00, 0.83, 0.30, 0.14),  # bottom-left
]

# ---------------------------------------------------------------------------
# ROI cache — avoids running auto-detection on every sampled frame.
# The counter is incremented once per extract_scoreboard() call (i.e. once per
# sampled frame, NOT per raw video frame); detection re-runs every
# _CACHE_REFRESH_INTERVAL calls to recover from camera cuts. Initialised to the
# interval so detection runs on the very first call.
# Call reset_roi_cache() between matches so a ROI detected for one video never
# leaks into the next when several are processed in the same long-lived process.
# ---------------------------------------------------------------------------
_CACHE_REFRESH_INTERVAL: int = 300  # extract_scoreboard() calls
_cached_roi: tuple[int, int, int, int] | None = None
_cache_frame_counter: int = _CACHE_REFRESH_INTERVAL  # triggers detection on first call

# No char whitelist on purpose: the team abbreviations ("TVB", "THW") separate
# the score and clock digit groups. Whitelisting to digits dropped the letters
# and glued multi-number readings into one token ("272151:49"), which broke
# score parsing. Letters are kept here and filtered out in _parse_reading.
_TESSERACT_CONFIG = "--psm 7"

# Standard Tesseract install location on Windows (not on PATH by default).
_WINDOWS_TESSERACT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

try:
    import pytesseract

    # On Linux/macOS (and in Docker) the `tesseract` binary is found on PATH, so
    # we leave pytesseract's default alone. Only point it at an explicit binary
    # when one is configured via TESSERACT_CMD, or on Windows where the default
    # install isn't on PATH.
    if _cmd := os.environ.get("TESSERACT_CMD"):
        pytesseract.pytesseract.tesseract_cmd = _cmd
    elif sys.platform == "win32" and Path(_WINDOWS_TESSERACT).exists():
        pytesseract.pytesseract.tesseract_cmd = _WINDOWS_TESSERACT
    AVAILABLE: bool = True
except ImportError:
    AVAILABLE = False


@dataclass(frozen=True)
class ScoreboardReading:
    frame_number: int
    timestamp_sec: float
    game_time: str | None  # "MM:SS" or None when OCR yields no match
    score_home: int | None
    score_away: int | None


def _preprocess(frame: np.ndarray, roi: tuple[int, int, int, int]) -> np.ndarray:  # type: ignore[type-arg]
    """Crop the given ROI from frame and prepare it for Tesseract."""
    x, y, w, h = roi
    region = frame[y : y + h, x : x + w]
    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
    enhanced = cv2.convertScaleAbs(gray, alpha=1.5, beta=0)
    _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    upscaled: np.ndarray = cv2.resize(  # type: ignore[type-arg]
        binary, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC
    )
    return upscaled


# A handball game clock: MM:SS with seconds 00-59. A strong scoreboard signal.
_TIME_RE = re.compile(r"\b(\d{1,2}):([0-5]\d)\b")


def _is_plausible(text: str) -> bool:
    """Return True if text contains at least two integers in 0-99 (score candidates)."""
    cleaned = re.sub(r"\d{1,2}:\d{2}", " ", text)
    candidates = [int(m) for m in re.findall(r"\b(\d{1,2})\b", cleaned) if int(m) <= 99]
    return len(candidates) >= 2


def _has_game_time(text: str) -> bool:
    """Return True if text contains a plausible MM:SS clock — a strong scoreboard cue."""
    return _TIME_RE.search(text) is not None


def _clamp_roi(
    roi: tuple[int, int, int, int], frame_h: int, frame_w: int
) -> tuple[int, int, int, int] | None:
    """Clamp an ROI to the frame bounds. Returns None when nothing is left to crop.

    Guards against ROIs that assume a larger resolution than the actual frame
    (e.g. the 1080p fallback constants on a 720p video), which would otherwise
    produce an empty crop and crash the OpenCV preprocessing.
    """
    x, y, w, h = roi
    x = max(0, min(x, frame_w))
    y = max(0, min(y, frame_h))
    w = min(w, frame_w - x)
    h = min(h, frame_h - y)
    if w <= 0 or h <= 0:
        return None
    return (x, y, w, h)


def _find_scoreboard_roi(frame: np.ndarray) -> tuple[int, int, int, int] | None:  # type: ignore[type-arg]
    """
    Check each ROI candidate and return the most scoreboard-like one.

    A candidate whose OCR also yields a valid MM:SS game clock is taken
    immediately (strong scoreboard signal, hard to hit by chance on jersey
    numbers or adverts). Otherwise the first candidate with at least two
    score-like numbers is kept as a weaker fallback.

    Returns (x, y, w, h) in absolute pixel coordinates clamped to the frame,
    or None if no candidate yields a readable scoreboard.
    """
    if not AVAILABLE:
        return None

    h_frame, w_frame = frame.shape[:2]
    score_only_fallback: tuple[int, int, int, int] | None = None
    for x_rel, y_rel, w_rel, h_rel in _ROI_CANDIDATES:
        roi = _clamp_roi(
            (
                int(x_rel * w_frame),
                int(y_rel * h_frame),
                int(w_rel * w_frame),
                int(h_rel * h_frame),
            ),
            h_frame,
            w_frame,
        )
        if roi is None:
            continue
        try:
            preprocessed = _preprocess(frame, roi)
            text: str = pytesseract.image_to_string(  # type: ignore[name-defined]
                preprocessed, config=_TESSERACT_CONFIG
            )
        except Exception:
            continue
        if not _is_plausible(text):
            continue
        if _has_game_time(text):
            logger.debug("Scoreboard ROI (with clock) found at %s", roi)
            return roi
        if score_only_fallback is None:
            score_only_fallback = roi

    if score_only_fallback is not None:
        logger.debug("Scoreboard ROI (scores only) found at %s", score_only_fallback)
    return score_only_fallback


def _parse_reading(text: str) -> tuple[str | None, int | None, int | None]:
    """Return (game_time, score_home, score_away) parsed from raw Tesseract output."""
    time_match = _TIME_RE.search(text)
    game_time = f"{time_match.group(1)}:{time_match.group(2)}" if time_match else None

    # Strip timestamps so their digits don't leak into the score candidates.
    cleaned = re.sub(r"\d{1,2}:\d{2}", " ", text)

    # On a real scoreboard each score sits right after its team abbreviation
    # ("TVB 27 THW 21"). Anchoring on the letters ignores stray OCR noise to the
    # left of the board ("7 TVB 27 THW 21 …" → 27, not the leading 7).
    anchored = [int(m) for m in re.findall(r"[A-Za-z]+\s*(\d{1,2})\b", cleaned) if int(m) <= 99]
    if len(anchored) >= 2:
        return game_time, anchored[0], anchored[1]
    if len(anchored) == 1:
        return game_time, anchored[0], None

    # Fallback when OCR produced no team labels (e.g. digits-only input): take
    # the first two standalone 1-2 digit integers (handball scores stay ≤ 99).
    candidates = [int(m) for m in re.findall(r"\b(\d{1,2})\b", cleaned) if int(m) <= 99]
    score_home = candidates[0] if len(candidates) >= 1 else None
    score_away = candidates[1] if len(candidates) >= 2 else None

    return game_time, score_home, score_away


def extract_scoreboard(
    frame: np.ndarray,  # type: ignore[type-arg]
    frame_number: int,
    timestamp_sec: float,
) -> ScoreboardReading:
    """
    Extract game time and score from one video frame.

    Auto-detects the scoreboard ROI on the first call and every
    _CACHE_REFRESH_INTERVAL frames to handle camera cuts.  Falls back to
    the legacy ROI constants when detection finds nothing.
    Returns a ScoreboardReading with NULL fields when OCR fails or yields
    no parseable values.
    """
    global _cached_roi, _cache_frame_counter

    _cache_frame_counter += 1
    if _cache_frame_counter >= _CACHE_REFRESH_INTERVAL or _cached_roi is None:
        _cached_roi = _find_scoreboard_roi(frame)
        _cache_frame_counter = 0

    raw_roi = _cached_roi if _cached_roi is not None else (ROI_X, ROI_Y, ROI_WIDTH, ROI_HEIGHT)

    null_reading = ScoreboardReading(
        frame_number=frame_number,
        timestamp_sec=timestamp_sec,
        game_time=None,
        score_home=None,
        score_away=None,
    )

    h_frame, w_frame = frame.shape[:2]
    roi = _clamp_roi(raw_roi, h_frame, w_frame)
    if roi is None:
        logger.warning(
            "Scoreboard ROI %s lies outside the %dx%d frame %d — skipping",
            raw_roi,
            w_frame,
            h_frame,
            frame_number,
        )
        return null_reading

    try:
        preprocessed = _preprocess(frame, roi)
        text: str = pytesseract.image_to_string(  # type: ignore[name-defined]
            preprocessed, config=_TESSERACT_CONFIG
        )
    except Exception as exc:
        logger.warning("Tesseract OCR failed on frame %d: %s", frame_number, exc)
        return null_reading

    game_time, score_home, score_away = _parse_reading(text)
    logger.debug(
        "frame %d: game_time=%s home=%s away=%s (raw=%r)",
        frame_number,
        game_time,
        score_home,
        score_away,
        text.strip(),
    )
    return ScoreboardReading(
        frame_number=frame_number,
        timestamp_sec=timestamp_sec,
        game_time=game_time,
        score_home=score_home,
        score_away=score_away,
    )


def reset_roi_cache() -> None:
    """Forget the cached scoreboard ROI.

    Call once before processing a video so a ROI auto-detected for a previous
    match never leaks into the next when several matches are ingested in the
    same long-lived process (e.g. the FastAPI BackgroundTask).
    """
    global _cached_roi, _cache_frame_counter
    _cached_roi = None
    _cache_frame_counter = _CACHE_REFRESH_INTERVAL
