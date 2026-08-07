"""
Ingestion orchestrator — wires the pipeline stages together.

Flow per video:
  1. Open video, register match in DuckDB
  2. Warm-up phase: collect player detections for team classifier fitting
     (team labels are "unknown" during this phase)
  3. Fit team classifier on the accumulated samples
  4. Main phase: run full pipeline frame-by-frame and write to DuckDB
  5. Post-processing: compute velocities and ball-carrier flags via SQL

The orchestrator is the only place that knows about all pipeline stages.
Individual stages (detection, ball, team, court) have no knowledge of each other.

Each stage declares AVAILABLE at module level; the orchestrator checks this flag
before attempting construction. Stages that raise NotImplementedError (not yet
ported) are silently skipped — the pipeline degrades gracefully rather than crash.
"""

from __future__ import annotations

import contextlib
import logging
from pathlib import Path

import cv2
import numpy as np

from ingestion import goal_detector as _goal_detector_mod
from ingestion import scoreboard_ocr as _scoreboard_mod
from ingestion.config import IngestionSettings
from ingestion.device import resolve_device
from ingestion.pipeline import ball as _ball_mod
from ingestion.pipeline import court as _court_mod
from ingestion.pipeline import detection as _det_mod
from ingestion.pipeline import pose as _pose_mod
from ingestion.pipeline import team as _team_mod
from ingestion.pipeline import tracking_postprocessing as _postproc
from ingestion.pipeline.ball import BallDetector
from ingestion.pipeline.court import CourtMapper
from ingestion.pipeline.court_reference import COURT_REFERENCE
from ingestion.pipeline.detection import PersonDetector
from ingestion.pipeline.pose import PoseDetector
from ingestion.pipeline.role_filter import RoleLimits, filter_by_role
from ingestion.pipeline.team import TeamClassifier
from ingestion.storage.schema import connect
from ingestion.storage.writer import FrameWriter
from ingestion.types import BallState, Detection, FrameState, PlayerState
from ingestion.video import iter_frames, iter_sampled_frames
from ingestion.visualization.annotator import FrameAnnotator

logger = logging.getLogger(__name__)


class IngestionOrchestrator:
    def __init__(self, settings: IngestionSettings) -> None:
        # Resolve "auto"/"cuda"/"cpu" to a concrete device once, here, so every
        # pipeline stage receives a usable device regardless of how the
        # orchestrator was constructed (CLI flag, env var, or default).
        resolved = resolve_device(settings.device)
        if resolved != settings.device:
            settings = settings.model_copy(update={"device": resolved})
        self._settings = settings

        self._person_detector: PersonDetector | None = None
        if _det_mod.AVAILABLE:
            try:
                _det_path = settings.models_dir / settings.detection_model
                _det_path.parent.mkdir(parents=True, exist_ok=True)
                self._person_detector = PersonDetector(
                    model_path=str(_det_path),
                    confidence=settings.detection_confidence,
                    max_persons=settings.max_persons,
                    device=settings.device,
                    imgsz=settings.detection_imgsz,
                    half=settings.half,
                )
            except Exception as exc:
                logger.warning("PersonDetector: unavailable (%s) — person detection skipped", exc)
        else:
            logger.info("PersonDetector: ultralytics not installed — person detection skipped")

        self._ball_detector: BallDetector | None = None
        if _ball_mod.AVAILABLE:
            try:
                _ball_path = settings.models_dir / settings.ball_model
                _ball_path.parent.mkdir(parents=True, exist_ok=True)
                self._ball_detector = BallDetector(
                    model_path=str(_ball_path),
                    confidence=settings.ball_confidence,
                    device=settings.device,
                    imgsz=settings.ball_imgsz,
                    half=settings.half,
                )
            except Exception as exc:
                logger.warning("BallDetector: unavailable (%s) — ball detection skipped", exc)
        else:
            logger.info("BallDetector: ultralytics not installed — ball detection skipped")

        self._team: TeamClassifier | None = None
        if _team_mod.AVAILABLE:
            try:
                self._team = TeamClassifier(n_teams=settings.n_teams)
            except Exception as exc:
                logger.warning("TeamClassifier: unavailable (%s) — team stage skipped", exc)

        # --- Court keypoint detection (YOLO-Pose) ---
        self._pose_detector: PoseDetector | None = None
        if _pose_mod.AVAILABLE:
            try:
                _court_model_path = settings.models_dir / settings.court_model
                self._pose_detector = PoseDetector(
                    model_path=str(_court_model_path),
                    confidence=settings.court_confidence,
                    device=settings.device,
                    imgsz=settings.detection_imgsz,
                )
            except Exception as exc:
                logger.warning(
                    "PoseDetector: unavailable (%s) — court keypoint detection skipped", exc
                )
        else:
            logger.info(
                "PoseDetector: ultralytics not installed — court keypoint detection skipped"
            )

        # --- Court mapper ---
        # If a static calibration file is provided, use it.
        # Otherwise the orchestrator estimates homography per frame using PoseDetector.
        self._court: CourtMapper | None = None
        self._court_is_static: bool = False
        if settings.calibration_path is not None and _court_mod.AVAILABLE:
            try:
                self._court = CourtMapper.from_file(settings.calibration_path)
                self._court_is_static = True
            except (NotImplementedError, ValueError) as exc:
                logger.warning(
                    "CourtMapper.from_file: failed (%s) — will try per-frame detection", exc
                )

        self._min_court_keypoints: int = settings.min_court_keypoints
        self._role_limits = RoleLimits(
            max_goalkeepers=settings.max_goalkeepers,
            max_referees=settings.max_referees,
            max_field_players=settings.max_field_players,
        )

    def run(
        self,
        video_path: Path,
        match_id: str,
        output_video_path: Path | None = None,
    ) -> None:
        """
        Process one video file end-to-end and write all results to DuckDB.

        Args:
            output_video_path: If provided, write an annotated copy of the video here.

        Raises ValueError if match_id already exists in the database.
        """
        settings = self._settings
        conn = connect(settings.duckdb_path)

        existing = conn.execute("SELECT 1 FROM matches WHERE match_id = ?", [match_id]).fetchone()
        if existing:
            raise ValueError(f"match_id '{match_id}' already exists in the database")

        warmup_limit = settings.team_warmup_frames

        if self._person_detector is not None and self._team is not None:
            logger.info(
                "Phase 1: team classifier warm-up (%d frames, evenly sampled)", warmup_limit
            )
            try:
                for vf in iter_sampled_frames(video_path, warmup_limit):
                    players_raw = self._person_detector.detect(vf.frame)
                    self._team.collect_players(vf.frame, [det.bbox for det in players_raw])
                self._team.fit()
                logger.info("Team classifier fitted")
            except NotImplementedError:
                logger.warning("Team warmup skipped: stage not yet ported")
        else:
            logger.info("Phase 1: skipped (person detector or team classifier unavailable)")

        meta = next(iter_frames(video_path))
        conn.execute(
            "INSERT INTO matches (match_id, video_path, fps, total_frames) VALUES (?,?,?,?)",
            [match_id, str(video_path), meta.fps, meta.total_frames],
        )
        conn.commit()

        annotator = FrameAnnotator() if output_video_path is not None else None
        video_writer: cv2.VideoWriter | None = None
        if output_video_path is not None:
            video_writer = _open_video_writer(output_video_path, meta.fps, meta.frame)
            if not video_writer.isOpened():
                logger.warning(
                    "VideoWriter could not be opened for %s — annotated video will not be written",
                    output_video_path,
                )
                video_writer = None
                annotator = None

        stride = settings.frame_stride
        processed = meta.total_frames // stride
        logger.info(
            "Phase 2: full pipeline (%d total frames, stride=%d → ~%d processed)",
            meta.total_frames,
            stride,
            processed,
        )
        # Sample the scoreboard at a fixed wall-clock cadence (independent of
        # frame_stride, which otherwise made the modulo trigger fire on an
        # irregular subset of frames) and start with a clean ROI cache so a ROI
        # detected for a previous match never leaks into this one.
        _scoreboard_mod.reset_roi_cache()
        scoreboard_interval_sec = 1.0
        next_scoreboard_ts = 0.0
        with FrameWriter(conn, match_id) as writer:
            for vf in iter_frames(video_path, stride=stride):
                frame_state = self._process_frame(vf.frame, vf.frame_id, vf.timestamp_s)
                writer.write(frame_state)
                if video_writer is not None and annotator is not None:
                    video_writer.write(annotator.annotate(vf.frame, frame_state))

                if _scoreboard_mod.AVAILABLE and vf.timestamp_s >= next_scoreboard_ts:
                    next_scoreboard_ts = vf.timestamp_s + scoreboard_interval_sec
                    reading = _scoreboard_mod.extract_scoreboard(
                        vf.frame, vf.frame_id, vf.timestamp_s
                    )
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO scoreboard_readings
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        [
                            match_id,
                            reading.frame_number,
                            reading.timestamp_sec,
                            reading.game_time,
                            reading.score_home,
                            reading.score_away,
                        ],
                    )

                if vf.frame_id % 100 == 0:
                    logger.info("  frame %d / %d", vf.frame_id, vf.total_frames)

        if video_writer is not None:
            video_writer.release()
            assert output_video_path is not None
            _ensure_h264(output_video_path)

        logger.info("Phase 3a: ghost track cleanup")
        n_reassigned, n_dropped = _postproc.filter_ghosts(
            conn,
            match_id,
            ghost_threshold=settings.ghost_threshold,
            max_reassign_dist=settings.max_reassign_dist,
        )
        logger.info("  %d reassigned, %d dropped", n_reassigned, n_dropped)

        if settings.id_switch_max_gap > 0:
            logger.info("Phase 3b: ID switch detection and merging")
            switches = _postproc.detect_id_switches(
                conn,
                match_id,
                max_gap=settings.id_switch_max_gap,
                max_dist=settings.id_switch_max_dist,
            )
            if switches:
                n_merged = _postproc.merge_id_switches(conn, match_id, switches)
                logger.info("  %d ID switch(es) merged", n_merged)
            else:
                logger.info("  no ID switches detected")

        logger.info("Phase 3c: track interpolation")
        n_interpolated = _postproc.interpolate_tracks(conn, match_id)
        logger.info("  %d rows inserted", n_interpolated)

        logger.info("Phase 4: post-processing (velocities + ball carrier)")
        _compute_velocities(conn, match_id, meta.fps)
        _mark_ball_carrier(conn, match_id)

        goals = _goal_detector_mod.detect_goals(conn, match_id)
        _goal_detector_mod.save_goals(conn, goals)
        logger.info("Goals detected: %d", len(goals))
        conn.commit()

        logger.info("Ingestion complete: %s", match_id)

    def _process_frame(self, frame: object, frame_id: int, timestamp_s: float) -> FrameState:
        assert isinstance(frame, np.ndarray)

        # --- Per-frame court mapping via PoseDetector ---
        if not self._court_is_static and self._pose_detector is not None:
            with contextlib.suppress(NotImplementedError):
                keypoints = self._pose_detector.detect(frame)
                valid_count = sum(1 for p in keypoints if p is not None)
                if valid_count >= self._min_court_keypoints:
                    mapper = CourtMapper.from_keypoints(keypoints, COURT_REFERENCE)
                    if mapper is not None:
                        self._court = mapper

        players_raw: list[Detection] = []
        if self._person_detector is not None:
            with contextlib.suppress(NotImplementedError):
                players_raw = self._person_detector.detect(frame)
            players_raw = filter_by_role(players_raw, self._role_limits)

        ball_raw: Detection | None = None
        if self._ball_detector is not None:
            with contextlib.suppress(NotImplementedError):
                ball_raw = self._ball_detector.detect(frame)

        # Classify all players of the frame in one call — the full-frame
        # preprocessing inside the classifier runs once, not once per player.
        teams: list[str] = [det.class_name for det in players_raw]  # fallback: YOLO class label
        if self._team is not None and self._team.is_fitted and players_raw:
            with contextlib.suppress(NotImplementedError):
                teams = self._team.classify_players(frame, [det.bbox for det in players_raw])

        players: list[PlayerState] = []
        for det, team in zip(players_raw, teams, strict=True):
            court_pos: tuple[float, float] | None = None
            if self._court is not None:
                with contextlib.suppress(NotImplementedError):
                    court_pos = self._court.transform(det.bbox.foot)

            players.append(
                PlayerState(
                    track_id=det.track_id,
                    bbox=det.bbox,
                    confidence=det.confidence,
                    team=team,
                    court_pos=court_pos,
                )
            )

        ball: BallState | None = None
        if ball_raw is not None:
            ball_court_pos: tuple[float, float] | None = None
            if self._court is not None:
                with contextlib.suppress(NotImplementedError):
                    ball_court_pos = self._court.transform(ball_raw.bbox.center)
            ball = BallState(
                bbox=ball_raw.bbox,
                confidence=ball_raw.confidence,
                court_pos=ball_court_pos,
            )

        return FrameState(
            frame_id=frame_id,
            timestamp_s=timestamp_s,
            players=players,
            ball=ball,
        )


def _open_video_writer(
    path: Path,
    fps: float,
    reference_frame: np.ndarray,  # type: ignore[type-arg]
) -> cv2.VideoWriter:
    h, w = reference_frame.shape[:2]
    # Try H.264 first (browser-compatible), fall back to mp4v.
    # mp4v (MPEG-4 Part 2) is not playable in browsers — _ensure_h264()
    # will transcode it after the pipeline finishes.
    for fourcc_str in ("avc1", "x264", "mp4v"):
        fourcc = cv2.VideoWriter_fourcc(*fourcc_str)  # type: ignore[attr-defined]
        writer = cv2.VideoWriter(str(path), fourcc, fps, (w, h))
        if writer.isOpened():
            return writer
    # Last resort: return the (possibly broken) writer so caller can detect it
    return writer


def _ensure_h264(path: Path) -> None:
    """Re-encode to H.264 via ffmpeg if the file is not already H.264."""
    import shutil
    import subprocess

    if shutil.which("ffprobe") is None:
        logger.warning("ffprobe not found; skipping H.264 compatibility check for %s", path.name)
        return

    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=codec_name",
            "-of",
            "csv=p=0",
            str(path),
        ],
        capture_output=True,
        text=True,
    )
    codec = result.stdout.strip()
    if codec in ("h264", ""):
        return  # already H.264 or probe failed — nothing to do

    if shutil.which("ffmpeg") is None:
        logger.warning("ffmpeg not found; skipping H.264 transcode for %s", path.name)
        return

    logger.info("Transcoding %s from %s to H.264 for browser playback", path.name, codec)
    tmp = path.with_suffix(".tmp.mp4")
    ret = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(path),
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
            "-c:a",
            "copy",
            "-movflags",
            "+faststart",
            str(tmp),
        ],
        capture_output=True,
        text=True,
    )
    if ret.returncode == 0 and tmp.exists():
        shutil.move(str(tmp), str(path))
    else:
        logger.warning("ffmpeg transcode failed (exit %d): %s", ret.returncode, ret.stderr[:500])
        tmp.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Post-processing SQL — runs after all frames are written
# ---------------------------------------------------------------------------


def _compute_velocities(conn: object, match_id: str, fps: float) -> None:
    """
    Fill velocity_x / velocity_y from position deltas using SQL window functions.
    Requires court_x/court_y to be non-NULL (i.e. calibration was provided).
    """
    import duckdb as _duckdb

    assert isinstance(conn, _duckdb.DuckDBPyConnection)

    conn.execute(
        """
        UPDATE players AS p
        SET velocity_x = sub.vx,
            velocity_y = sub.vy
        FROM (
            SELECT
                match_id,
                frame_id,
                track_id,
                COALESCE(
                    (court_x - LAG(court_x) OVER w)
                        / NULLIF(frame_id - LAG(frame_id) OVER w, 0) * ?,
                    0
                ) AS vx,
                COALESCE(
                    (court_y - LAG(court_y) OVER w)
                        / NULLIF(frame_id - LAG(frame_id) OVER w, 0) * ?,
                    0
                ) AS vy
            FROM players
            WHERE match_id = ?
            WINDOW w AS (PARTITION BY match_id, track_id ORDER BY frame_id)
        ) sub
        WHERE p.match_id = sub.match_id
          AND p.frame_id = sub.frame_id
          AND p.track_id = sub.track_id
        """,
        [fps, fps, match_id],
    )


def _mark_ball_carrier(conn: object, match_id: str) -> None:
    """Mark the player closest to the ball in each frame as has_ball=TRUE."""
    import duckdb as _duckdb

    assert isinstance(conn, _duckdb.DuckDBPyConnection)

    conn.execute(
        """
        UPDATE players AS p
        SET has_ball = TRUE
        FROM (
            SELECT pl.match_id, pl.frame_id, pl.track_id
            FROM players pl
            JOIN ball b ON pl.match_id = b.match_id AND pl.frame_id = b.frame_id
            WHERE pl.match_id = ?
              AND pl.court_x IS NOT NULL
              AND b.court_x  IS NOT NULL
            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY pl.match_id, pl.frame_id
                ORDER BY (pl.court_x - b.court_x)^2 + (pl.court_y - b.court_y)^2
            ) = 1
        ) sub
        WHERE p.match_id = sub.match_id
          AND p.frame_id = sub.frame_id
          AND p.track_id = sub.track_id
        """,
        [match_id],
    )
