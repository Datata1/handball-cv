"""Unit tests for scoreboard OCR parsing — no real frames, no Tesseract required."""

from unittest.mock import MagicMock, patch

import numpy as np

import ingestion.scoreboard_ocr as ocr_module
from ingestion.scoreboard_ocr import _parse_reading


def test_full_reading() -> None:
    game_time, home, away = _parse_reading("25:30 18 14")
    assert game_time == "25:30"
    assert home == 18
    assert away == 14


def test_scores_anchored_to_team_labels() -> None:
    # Real broadcast layout: each score sits right after its team abbreviation.
    game_time, home, away = _parse_reading("TVB 27 THW 21 51:49")
    assert game_time == "51:49"
    assert home == 27
    assert away == 21


def test_leading_ocr_noise_ignored_via_team_anchor() -> None:
    # A stray digit left of the board must NOT become the home score.
    game_time, home, away = _parse_reading("7 TVB 27 THW 21 51:33")
    assert game_time == "51:33"
    assert home == 27
    assert away == 21


def test_minutes_only_no_seconds() -> None:
    # OCR missed the colon and seconds — no game time, but scores still parseable.
    game_time, home, away = _parse_reading("25 18 14")
    assert game_time is None
    assert home == 25
    assert away == 18


def test_equal_score() -> None:
    game_time, home, away = _parse_reading("30:00 15 15")
    assert game_time == "30:00"
    assert home == 15
    assert away == 15


def test_empty_string() -> None:
    game_time, home, away = _parse_reading("")
    assert game_time is None
    assert home is None
    assert away is None


def test_find_scoreboard_roi_detects_bottom_left() -> None:
    """_find_scoreboard_roi() picks the bottom-left corner when only that region has readable scores."""
    # Synthetic 1080p frame — content doesn't matter; pytesseract is mocked.
    frame = np.zeros((1080, 1920, 3), dtype=np.uint8)

    # Return plausible text only on the 4th OCR call (bottom-left candidate).
    responses = iter(["noise", "noise", "noise", "15 12"])
    mock_pytesseract = MagicMock()
    mock_pytesseract.image_to_string.side_effect = lambda img, config="": next(responses)

    with (
        patch.object(ocr_module, "pytesseract", mock_pytesseract, create=True),
        patch.object(ocr_module, "AVAILABLE", True),
    ):
        result = ocr_module._find_scoreboard_roi(frame)

    assert result is not None
    x, y, w, h = result
    # bottom-left: x_rel=0.00, y_rel=0.83, w_rel=0.30, h_rel=0.14
    assert x == 0
    assert y == int(0.83 * 1080)
    assert w == int(0.30 * 1920)
    assert h == int(0.14 * 1080)


def test_find_scoreboard_roi_prefers_candidate_with_clock() -> None:
    """A candidate that also shows a MM:SS clock wins over an earlier scores-only one."""
    frame = np.zeros((1080, 1920, 3), dtype=np.uint8)

    # Candidate order: top-right, top-left, bottom-right, bottom-left.
    # top-right has scores only; top-left has scores + clock → top-left must win.
    responses = iter(["15 12", "25:30 18 14", "noise", "noise"])
    mock_pytesseract = MagicMock()
    mock_pytesseract.image_to_string.side_effect = lambda img, config="": next(responses)

    with (
        patch.object(ocr_module, "pytesseract", mock_pytesseract, create=True),
        patch.object(ocr_module, "AVAILABLE", True),
    ):
        result = ocr_module._find_scoreboard_roi(frame)

    assert result is not None
    x, y, _w, _h = result
    # top-left candidate: x_rel=0.00, y_rel=0.02
    assert x == 0
    assert y == int(0.02 * 1080)


def test_extract_scoreboard_out_of_bounds_roi_returns_null() -> None:
    """A 1080p fallback ROI on a smaller frame must not crash — returns NULLs."""
    ocr_module.reset_roi_cache()
    small_frame = np.zeros((200, 200, 3), dtype=np.uint8)  # fallback y=963 is off-frame

    mock_pytesseract = MagicMock()
    with (
        patch.object(ocr_module, "pytesseract", mock_pytesseract, create=True),
        patch.object(ocr_module, "AVAILABLE", True),
        # Force the fallback-ROI path: auto-detection finds nothing.
        patch.object(ocr_module, "_find_scoreboard_roi", lambda frame: None),
    ):
        reading = ocr_module.extract_scoreboard(small_frame, 0, 0.0)

    assert reading.game_time is None
    assert reading.score_home is None
    assert reading.score_away is None
    # OCR must never be reached when the ROI lies entirely outside the frame.
    mock_pytesseract.image_to_string.assert_not_called()


def test_reset_roi_cache_clears_cached_roi() -> None:
    """reset_roi_cache() drops a cached ROI so the next match re-detects from scratch."""
    ocr_module._cached_roi = (1, 2, 3, 4)
    ocr_module.reset_roi_cache()
    assert ocr_module._cached_roi is None


def test_score_zero_zero() -> None:
    game_time, home, away = _parse_reading("0 0")
    assert game_time is None
    assert home == 0
    assert away == 0


def test_triple_digit_number_ignored() -> None:
    # 205 > 99, gets filtered out; only "3" remains → home score, no away
    game_time, home, away = _parse_reading("205 3")
    assert game_time is None
    assert home == 3
    assert away is None


def test_game_time_at_end_of_string() -> None:
    # Tesseract sometimes puts the clock last rather than first
    game_time, home, away = _parse_reading("18 14 25:30")
    assert game_time == "25:30"
    assert home == 18
    assert away == 14


def test_only_one_number() -> None:
    game_time, home, away = _parse_reading("7")
    assert game_time is None
    assert home == 7
    assert away is None


def test_game_time_only_no_scores() -> None:
    game_time, home, away = _parse_reading("25:30")
    assert game_time == "25:30"
    assert home is None
    assert away is None


def test_invalid_seconds_not_matched_as_time() -> None:
    # Seconds 70 fail the [0-5]\d regex → no game_time extracted
    game_time, home, away = _parse_reading("25:70 5 3")
    assert game_time is None
    assert home == 5
    assert away == 3


def test_whitespace_only() -> None:
    game_time, home, away = _parse_reading("   ")
    assert game_time is None
    assert home is None
    assert away is None


def test_second_half_time() -> None:
    # Times > 30:00 are valid (overtime, second half)
    game_time, home, away = _parse_reading("45:30 22 19")
    assert game_time == "45:30"
    assert home == 22
    assert away == 19


def test_time_digits_not_leaking_into_scores() -> None:
    # The "25" and "30" from the time "25:30" must NOT appear as score candidates
    game_time, home, away = _parse_reading("25:30 7 4")
    assert game_time == "25:30"
    assert home == 7
    assert away == 4
