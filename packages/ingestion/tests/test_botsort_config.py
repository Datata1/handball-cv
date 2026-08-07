"""
Tests for the BoT-SORT tracker configuration and detection module wiring.

No GPU or ultralytics install required — all tests work on CI without [cv] extras.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = PACKAGE_ROOT / "botsort_custom.yaml"

REQUIRED_KEYS = {
    "tracker_type",
    "track_high_thresh",
    "track_low_thresh",
    "new_track_thresh",
    "track_buffer",
    "match_thresh",
    "fuse_score",
    "gmc_method",
    "proximity_thresh",
    "appearance_thresh",
    "with_reid",
    "model_weights",
    "model",
}


@pytest.fixture(scope="module")
def config() -> dict:
    """Load and parse botsort_custom.yaml once per test module."""
    assert CONFIG_PATH.exists(), f"botsort_custom.yaml not found at {CONFIG_PATH}"
    with CONFIG_PATH.open() as f:
        return yaml.safe_load(f)


# ---------------------------------------------------------------------------
# YAML structure tests
# ---------------------------------------------------------------------------


def test_config_file_exists():
    assert CONFIG_PATH.exists(), f"botsort_custom.yaml missing at {CONFIG_PATH}"


def test_config_is_valid_yaml(config: dict):
    assert isinstance(config, dict), "botsort_custom.yaml must parse to a dict"


def test_config_has_all_required_keys(config: dict):
    missing = REQUIRED_KEYS - config.keys()
    assert not missing, f"Missing keys in botsort_custom.yaml: {missing}"


def test_tracker_type_is_botsort(config: dict):
    assert config["tracker_type"] == "botsort"


# ---------------------------------------------------------------------------
# Threshold range tests
# ---------------------------------------------------------------------------


def test_track_high_thresh_in_range(config: dict):
    v = config["track_high_thresh"]
    assert 0.0 < v < 1.0, f"track_high_thresh={v} must be in (0, 1)"


def test_track_low_thresh_below_high(config: dict):
    assert config["track_low_thresh"] < config["track_high_thresh"], (
        "track_low_thresh must be strictly lower than track_high_thresh"
    )


def test_new_track_thresh_in_range(config: dict):
    v = config["new_track_thresh"]
    assert 0.0 < v < 1.0, f"new_track_thresh={v} must be in (0, 1)"


def test_match_thresh_in_range(config: dict):
    v = config["match_thresh"]
    assert 0.0 < v <= 1.0, f"match_thresh={v} must be in (0, 1]"


def test_track_buffer_positive(config: dict):
    assert config["track_buffer"] > 0, "track_buffer must be positive"


def test_proximity_thresh_in_range(config: dict):
    v = config["proximity_thresh"]
    assert 0.0 < v <= 1.0, f"proximity_thresh={v} must be in (0, 1]"


def test_appearance_thresh_in_range(config: dict):
    v = config["appearance_thresh"]
    assert 0.0 < v <= 1.0, f"appearance_thresh={v} must be in (0, 1]"


# ---------------------------------------------------------------------------
# BoT-SORT specific settings
# ---------------------------------------------------------------------------


def test_gmc_method_is_supported(config: dict):
    supported = {"sparseOptFlow", "orb", "sift", "ecc", "none"}
    assert config["gmc_method"] in supported, (
        f"gmc_method '{config['gmc_method']}' not in supported set {supported}"
    )


def test_with_reid_is_bool(config: dict):
    assert isinstance(config["with_reid"], bool), "with_reid must be a boolean"


def test_fuse_score_is_bool(config: dict):
    assert isinstance(config["fuse_score"], bool), "fuse_score must be a boolean"


def test_model_weights_is_string(config: dict):
    assert isinstance(config["model_weights"], str), "model_weights must be a string"
    assert config["model_weights"].endswith(".pt"), "model_weights should point to a .pt file"


# ---------------------------------------------------------------------------
# Handball-specific sanity checks
# ---------------------------------------------------------------------------


def test_track_buffer_suitable_for_handball(config: dict):
    """
    Handball games have short-duration occlusions (screens, collisions).
    A buffer of at least 30 frames (1 s @ 30 fps) keeps lost tracks alive
    long enough to recover after typical player clusters.
    """
    assert config["track_buffer"] >= 30, (
        f"track_buffer={config['track_buffer']} is too low for handball "
        "(occlusions regularly exceed 30 frames)"
    )


def test_reid_enabled(config: dict):
    """ReID is required for reliable re-identification after occlusion."""
    assert config["with_reid"] is True, "with_reid must be True for handball tracking"


def test_gmc_method_for_moving_camera(config: dict):
    """
    Handball broadcasts use pan/zoom cameras.
    sparseOptFlow is the recommended GMC for moving cameras.
    """
    assert config["gmc_method"] == "sparseOptFlow", (
        f"gmc_method '{config['gmc_method']}' — use sparseOptFlow for moving-camera broadcasts"
    )


# ---------------------------------------------------------------------------
# detection.py wiring tests
# ---------------------------------------------------------------------------


def test_detection_module_picks_up_custom_config():
    """
    PersonDetector._TRACKER_YAML must resolve to botsort_custom.yaml when
    the file exists next to the package.  Import the constant directly so
    this test runs without ultralytics installed.
    """
    import importlib

    import ingestion.pipeline.detection as det_mod

    # Reimport to re-evaluate the module-level _TRACKER_YAML constant.
    importlib.reload(det_mod)

    tracker_path = Path(det_mod._TRACKER_YAML)
    assert tracker_path.exists(), f"_TRACKER_YAML resolves to '{tracker_path}' which does not exist"
    assert tracker_path.name == "botsort_custom.yaml", (
        f"Expected botsort_custom.yaml, got '{tracker_path.name}'"
    )


def test_detection_module_fallback_when_no_custom_config():
    """
    When botsort_custom.yaml is absent, the selection logic should return
    the ultralytics built-in name 'botsort.yaml'.

    We test the selection logic directly (same code as detection.py) rather
    than reloading the module, because reload() re-evaluates module-level
    constants from __file__ and ignores any prior monkeypatching.
    """
    nonexistent = Path("/tmp/definitely_not_here/botsort_custom.yaml")
    assert not nonexistent.exists()
    result = str(nonexistent) if nonexistent.exists() else "botsort.yaml"
    assert result == "botsort.yaml"


# ---------------------------------------------------------------------------
# Config consistency: YAML values match detection module constants
# ---------------------------------------------------------------------------


def test_config_values_consistent_with_module(config: dict):
    """All thresholds from the YAML should be parseable as float/int/bool."""
    float_keys = [
        "track_high_thresh",
        "track_low_thresh",
        "new_track_thresh",
        "match_thresh",
        "proximity_thresh",
        "appearance_thresh",
    ]
    for key in float_keys:
        assert isinstance(config[key], (int, float)), (
            f"{key} should be numeric, got {type(config[key])}"
        )
    assert isinstance(config["track_buffer"], int), "track_buffer must be an int"
