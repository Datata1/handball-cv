from pathlib import Path

from pydantic_settings import BaseSettings

# Anchor to repo root regardless of the working directory the CLI is invoked from.
# packages/ingestion/src/ingestion/config.py → go up 4 levels → repo root
_REPO_ROOT = Path(__file__).resolve().parents[4]


class IngestionSettings(BaseSettings):
    model_config = {"env_prefix": "WELS_"}

    # Model identifiers — resolved against models_dir if not absolute paths
    detection_model: str = "player_detection.pt"
    ball_model: str = "ball_detection.pt"  # custom single-class handball ball model
    court_model: str = "court_detection.pt"  # YOLO-Pose court keypoint model

    # Detection thresholds
    detection_confidence: float = 0.3
    ball_confidence: float = 0.15
    court_confidence: float = 0.25  # keypoint visibility threshold for court detection
    min_court_keypoints: int = 4  # minimum keypoints needed for homography estimation
    max_persons: int = 20
    n_teams: int = 2

    # Handball role limits — soft caps per YOLO class per frame.
    # Excess detections are pruned by lowest confidence first.
    # Set to 0 to disable a specific cap (keeps all detections of that class).
    max_goalkeepers: int = 2  # 1 per team
    max_referees: int = 2
    max_field_players: int = 12  # 6 per team

    # Inference performance
    # imgsz: larger = more accurate on small/distant players, slower.
    #   1280 — high quality (original default)
    #    960 — good balance; ~1.7x faster than 1280
    #    640 — fastest; may miss distant players on wide-angle shots
    detection_imgsz: int = 1280
    # Ball detection input size — independent of detection_imgsz because the
    # ball is much smaller than players: higher values catch more distant
    # balls, lower values are faster. 640 matches the previous behaviour
    # (ultralytics predict default).
    ball_imgsz: int = 1280
    # half: FP16 inference — ~1.5-2x faster on RTX 30xx/40xx, no quality loss.
    # Automatically disabled when the resolved device is "cpu" (no FP16 YOLO on CPU).
    half: bool = True

    # "auto" detects a CUDA GPU at runtime and uses it, otherwise falls back to
    # CPU — no manual configuration needed. Force a device with "cuda" or "cpu".
    device: str = "auto"

    # Storage — absolute paths anchored to repo root
    duckdb_path: Path = _REPO_ROOT / "data/output/duckdb/matches.duckdb"
    models_dir: Path = _REPO_ROOT / "data/input/models/ingestion"

    # Court calibration JSON file (optional — no court mapping if unset)
    calibration_path: Path | None = None

    # How many frames to accumulate before fitting the team classifier
    team_warmup_frames: int = 150

    # Process every Nth frame in Phase 2 (stride=2 → half the frames, 2x faster).
    # frame_id in DuckDB still reflects the original video frame number so
    # timestamps and velocity computations remain correct.
    frame_stride: int = 1

    # Tracking post-processing (Phase 3)
    # ghost_threshold: tracks seen in fewer frames than this are treated as spurious.
    ghost_threshold: int = 10
    # max_reassign_dist: before dropping a ghost detection, try to reassign it to the
    # nearest stable track if within this pixel distance.
    max_reassign_dist: float = 150.0
    # id_switch_max_gap / id_switch_max_dist: criteria for ID-switch detection.
    # Set id_switch_max_gap = 0 to disable ID-switch merging entirely.
    id_switch_max_gap: int = 8
    id_switch_max_dist: float = 100.0


settings = IngestionSettings()
