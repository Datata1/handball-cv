"""
Batch scoring job: reads ingested match data, writes pre-computed predictions.

Run this after wels-ingest and (optionally) wels-train:

    wels-score <match_id>

Four outputs are written to DuckDB:

  action_predictions  — per-frame action probabilities for the ball carrier
                        (requires a trained checkpoint; skipped if none exists)

  formations          — per-frame formation label for each team
                        (rule-based, no checkpoint needed)

  possession_phases   — smoothed possession phases with start/end timestamps
                        (derived from has_ball column, no checkpoint needed)

  play_events         — detected offensive plays (Kreuzen, Einläufer,
                        Tempogegenstoß) with start/end timestamps
                        (rule-based on court coordinates, no checkpoint needed)

  team_phases         — offense/defense phases from team centroid positions
                        (homography-based, independent of ball detection,
                        no checkpoint needed)

The backend reads from these tables. No on-the-fly inference at request time.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import duckdb

from ml.analysis import formation as formation_classifier
from ml.analysis import plays as play_detector
from ml.analysis.possession import PossessionPhase, detect_phases
from ml.analysis.team_phases import detect_team_phases
from ml.config import MLSettings
from ml.storage.schema import connect

_FORMATION_ENCODER_CHECKPOINT = "formation_encoder.pt"

logger = logging.getLogger(__name__)

# Score every Nth frame for formations (formations change slowly — no need per-frame)
_FORMATION_STRIDE = 5

# Minimum actual-video-frame span for a formation run to be recorded as a scene.
# At 25 fps with stride 5: 25 frames ≈ 1 second minimum.
_MIN_SCENE_FRAMES = 25


class MatchScorer:
    """
    Scores one match end-to-end and writes results to DuckDB.

    Usage:
        scorer = MatchScorer(settings, checkpoint_path)
        scorer.score(match_id)
    """

    def __init__(
        self,
        settings: MLSettings,
        checkpoint_path: Path | None = None,
    ) -> None:
        self._settings = settings
        self._checkpoint = checkpoint_path

        # Action predictor is optional — scoring still runs without a checkpoint
        self._predictor = None
        if checkpoint_path is not None and checkpoint_path.exists():
            from ml.inference import ActionInference

            self._predictor = ActionInference(checkpoint_path, settings)
            logger.info("Loaded action predictor from %s", checkpoint_path)
        else:
            logger.warning(
                "No checkpoint found at %s — action_predictions will be skipped",
                checkpoint_path,
            )

        # Contrastive formation encoder is optional
        self._formation_clf = None
        enc_path = settings.models_dir / _FORMATION_ENCODER_CHECKPOINT
        if enc_path.exists():
            from ml.analysis.formation_contrastive import ContrastiveFormationClassifier

            self._formation_clf = ContrastiveFormationClassifier.from_checkpoint(enc_path)
            logger.info("Loaded formation encoder from %s", enc_path)
        else:
            logger.info(
                "No formation encoder checkpoint found at %s — "
                "falling back to rule-based formation classifier",
                enc_path,
            )

    def score(self, match_id: str) -> None:
        """Score one match and write all output tables."""
        conn = connect(self._settings.duckdb_path)

        # Guard: ensure the match was ingested
        row = conn.execute("SELECT fps FROM matches WHERE match_id = ?", [match_id]).fetchone()
        if row is None:
            raise ValueError(f"Match '{match_id}' not found in database. Run wels-ingest first.")
        fps = float(row[0])

        # Clear any existing scoring results for this match (allow re-scoring)
        _clear_match(conn, match_id)

        logger.info("Scoring match: %s", match_id)

        if self._predictor is not None:
            logger.info("Step 1/5: action predictions")
            _score_actions(conn, match_id, self._predictor, self._settings)
        else:
            logger.info("Step 1/5: action predictions — skipped (no checkpoint)")

        logger.info("Step 2/5: formation classification")
        _classify_formations(conn, match_id, self._formation_clf)

        logger.info("Step 2b/5: formation scene aggregation")
        _aggregate_formation_scenes(conn, match_id, fps)

        logger.info("Step 3/5: possession phases")
        _detect_possession(conn, match_id, fps, self._settings)

        logger.info("Step 4/5: play detection")
        detect_play_events(conn, match_id, fps)

        logger.info("Step 5/5: team phases")
        _detect_team_phases(conn, match_id, fps)

        conn.commit()
        conn.close()
        logger.info("Scoring complete: %s", match_id)


# ---------------------------------------------------------------------------
# Step 1 — Action predictions
# ---------------------------------------------------------------------------


def _score_actions(
    conn: duckdb.DuckDBPyConnection,
    match_id: str,
    predictor: object,
    settings: MLSettings,
) -> None:
    """Write action_predictions rows for every ball-carrier frame."""
    from ml.inference import ActionInference

    assert isinstance(predictor, ActionInference)

    # Find all frames where a ball carrier exists and enough history is available
    carriers = conn.execute(
        """
        SELECT frame_id, track_id
        FROM players
        WHERE match_id = ?
          AND has_ball = TRUE
          AND frame_id >= ?
          AND court_x IS NOT NULL
        ORDER BY frame_id
        """,
        [match_id, settings.window_size - 1],
    ).fetchall()

    logger.info("  %d ball-carrier frames to score", len(carriers))

    batch: list[tuple] = []
    for frame_id, track_id in carriers:
        try:
            probs = predictor.predict(match_id, int(frame_id), int(track_id))
        except ValueError:
            continue  # not enough history for this frame

        predicted = max(probs, key=lambda k: probs[k])
        batch.append(
            (
                match_id,
                int(frame_id),
                int(track_id),
                probs["pass"],
                probs["shot"],
                probs["dribble"],
                probs["hold"],
                predicted,
            )
        )

        if len(batch) >= 500:
            _insert_predictions(conn, batch)
            batch = []

    if batch:
        _insert_predictions(conn, batch)


def _insert_predictions(
    conn: duckdb.DuckDBPyConnection,
    batch: list[tuple],  # type: ignore[type-arg]
) -> None:
    conn.executemany(
        "INSERT INTO action_predictions VALUES (?,?,?,?,?,?,?,?)",
        batch,
    )
    conn.commit()


# ---------------------------------------------------------------------------
# Step 2 — Formation classification
# ---------------------------------------------------------------------------


def _classify_formations(
    conn: duckdb.DuckDBPyConnection,
    match_id: str,
    formation_clf: object = None,
) -> None:
    """
    Write formations rows for both teams at every _FORMATION_STRIDE frames.

    When a ContrastiveFormationClassifier is provided it is used instead of the
    rule-based classifier. The contrastive model is robust to noisy homography
    output because it was trained with augmentations simulating position errors.
    """
    has_court = (
        conn.execute(
            "SELECT COUNT(*) FROM players WHERE match_id = ? AND court_x IS NOT NULL",
            [match_id],
        ).fetchone()[0]
        > 0
    )

    has_team_labels = (
        conn.execute(
            "SELECT COUNT(*) FROM players WHERE match_id = ? AND team IN ('A', 'B')",
            [match_id],
        ).fetchone()[0]
        > 0
    )

    use_court = has_court
    use_contrastive = formation_clf is not None

    # Pre-load per-frame, per-team average court_x so defending_left can be
    # determined dynamically per frame.  A global average would be wrong after
    # the halftime side-switch: the team with lower global avg_x would always
    # be marked as "defending left" even when they are attacking in the second
    # half.
    frame_team_avg_x: dict[tuple[int, str], float] = {}
    if use_court and has_team_labels:
        avg_rows = conn.execute(
            """
            SELECT frame_id, team, AVG(court_x) AS avg_x
            FROM players
            WHERE match_id = ? AND team IN ('A', 'B')
              AND court_x IS NOT NULL AND on_court = TRUE
            GROUP BY frame_id, team
            """,
            [match_id],
        ).fetchall()
        for fid, t, avg_x in avg_rows:
            if avg_x is not None:
                frame_team_avg_x[(int(fid), str(t))] = float(avg_x)

    # Determine which frames and teams to process
    coord_col = "court_x" if use_court else "pixel_foot_x"
    team_filter = "AND team IN ('A', 'B')" if has_team_labels else ""

    frame_ids = conn.execute(
        f"""
        SELECT DISTINCT frame_id FROM players
        WHERE match_id = ? AND {coord_col} IS NOT NULL {team_filter}
        ORDER BY frame_id
        """,
        [match_id],
    ).fetchall()

    teams = ("A", "B") if has_team_labels else ("all",)

    formation_batch: list[tuple] = []
    emb_batch: list[tuple] = []

    for (frame_id,) in frame_ids:
        if int(frame_id) % _FORMATION_STRIDE != 0:
            continue

        for team in teams:
            if team == "all":
                team_clause = ""
                team_params: list[object] = [match_id, frame_id]
            else:
                team_clause = "AND team = ?"
                team_params = [match_id, frame_id, team]

            if use_court:
                rows = conn.execute(
                    f"""
                    SELECT court_x, court_y FROM players
                    WHERE match_id = ? AND frame_id = ? {team_clause}
                      AND on_court = TRUE AND court_x IS NOT NULL
                    """,
                    team_params,
                ).fetchall()
                positions = [(float(x), float(y)) for x, y in rows]
            else:
                rows = conn.execute(
                    f"""
                    SELECT pixel_foot_x, pixel_foot_y FROM players
                    WHERE match_id = ? AND frame_id = ? {team_clause}
                      AND on_court = TRUE AND pixel_foot_x IS NOT NULL
                    """,
                    team_params,
                ).fetchall()
                positions = [(float(x), float(y)) for x, y in rows]

            if use_contrastive:
                from ml.analysis.formation_contrastive import ContrastiveFormationClassifier

                assert isinstance(formation_clf, ContrastiveFormationClassifier)
                label = formation_clf.classify(positions, use_court=use_court)
                if label != "unknown":
                    emb = formation_clf.embed(positions, use_court=use_court)
                    emb_batch.append(
                        (match_id, int(frame_id), team, label, float(emb[0]), float(emb[1]))
                    )
            else:
                # Determine defending side per frame: if the team's average
                # court_x in this frame is < 20 m (left half) they defend left.
                # This correctly handles the halftime side-switch.
                if use_court and team != "all":
                    avg_x = frame_team_avg_x.get((int(frame_id), str(team)), 20.0)
                    team_defending_left = avg_x < 20.0
                else:
                    team_defending_left = True
                label = formation_classifier.classify(
                    positions if use_court else [],
                    defending_left=team_defending_left,
                )

            formation_batch.append((match_id, int(frame_id), team, label))

        if len(formation_batch) >= 1000:
            conn.executemany("INSERT INTO formations VALUES (?,?,?,?)", formation_batch)
            if emb_batch:
                conn.executemany("INSERT INTO formation_embeddings VALUES (?,?,?,?,?,?)", emb_batch)
            conn.commit()
            formation_batch = []
            emb_batch = []

    if formation_batch:
        conn.executemany("INSERT INTO formations VALUES (?,?,?,?)", formation_batch)
        if emb_batch:
            conn.executemany("INSERT INTO formation_embeddings VALUES (?,?,?,?,?,?)", emb_batch)
        conn.commit()


# ---------------------------------------------------------------------------
# Step 2b — Formation scene aggregation
# ---------------------------------------------------------------------------


def _aggregate_formation_scenes(
    conn: duckdb.DuckDBPyConnection,
    match_id: str,
    fps: float,
    min_scene_frames: int = _MIN_SCENE_FRAMES,
) -> None:
    """
    Aggregate consecutive formation-stable frames into scenes with timestamps.

    Consecutive rows with the same team+formation are merged into one scene.
    Runs shorter than min_scene_frames actual video frames are discarded.
    "unknown" labels are never recorded as scenes.
    """
    rows = conn.execute(
        """
        SELECT frame_id, team, formation
        FROM formations
        WHERE match_id = ?
        ORDER BY team, frame_id
        """,
        [match_id],
    ).fetchall()

    if not rows:
        logger.info("  No formation data to aggregate into scenes")
        return

    scenes: list[tuple] = []
    scene_id = 0

    by_team: dict[str, list[tuple[int, str]]] = {}
    for frame_id, team, formation in rows:
        by_team.setdefault(str(team), []).append((int(frame_id), str(formation)))

    for team in sorted(by_team.keys()):
        team_rows = by_team[team]
        if not team_rows:
            continue

        run_formation, run_start, run_end = team_rows[0][1], team_rows[0][0], team_rows[0][0]

        for frame_id, formation in team_rows[1:]:
            if formation != run_formation:
                span = run_end - run_start + _FORMATION_STRIDE
                if run_formation != "unknown" and span >= min_scene_frames:
                    scenes.append(
                        (
                            match_id,
                            scene_id,
                            team,
                            run_formation,
                            run_start,
                            run_end,
                            round(run_start / fps, 3),
                            round((run_end + _FORMATION_STRIDE) / fps, 3),
                        )
                    )
                    scene_id += 1
                run_formation, run_start, run_end = formation, frame_id, frame_id
            else:
                run_end = frame_id

        # Flush the last run
        span = run_end - run_start + _FORMATION_STRIDE
        if run_formation != "unknown" and span >= min_scene_frames:
            scenes.append(
                (
                    match_id,
                    scene_id,
                    team,
                    run_formation,
                    run_start,
                    run_end,
                    round(run_start / fps, 3),
                    round((run_end + _FORMATION_STRIDE) / fps, 3),
                )
            )
            scene_id += 1

    if scenes:
        conn.executemany(
            """
            INSERT INTO formation_scenes
                (match_id, scene_id, team, formation,
                 start_frame, end_frame, start_time_s, end_time_s)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            scenes,
        )
        conn.commit()

    logger.info("  %d formation scenes aggregated", len(scenes))


# ---------------------------------------------------------------------------
# Step 3 — Possession phases
# ---------------------------------------------------------------------------


def _detect_possession(
    conn: duckdb.DuckDBPyConnection,
    match_id: str,
    fps: float,
    settings: MLSettings,
) -> None:
    """Write possession_phases from per-frame ball-carrier data."""
    rows = conn.execute(
        """
        SELECT f.frame_id, f.timestamp_s, p.team
        FROM frames f
        LEFT JOIN (
            SELECT frame_id, team
            FROM players
            WHERE match_id = ? AND has_ball = TRUE
        ) p ON f.frame_id = p.frame_id
        WHERE f.match_id = ?
        ORDER BY f.frame_id
        """,
        [match_id, match_id],
    ).fetchall()

    frame_dicts = [{"frame_id": r[0], "timestamp_s": r[1], "team": r[2]} for r in rows]

    phases: list[PossessionPhase] = detect_phases(frame_dicts, fps=fps)

    if phases:
        conn.executemany(
            """
            INSERT INTO possession_phases
                (match_id, phase_id, team, start_frame, end_frame, start_time_s, end_time_s)
            VALUES (?,?,?,?,?,?,?)
            """,
            [
                (
                    match_id,
                    p.phase_id,
                    p.team,
                    p.start_frame,
                    p.end_frame,
                    p.start_time_s,
                    p.end_time_s,
                )
                for p in phases
            ],
        )
        conn.commit()

    logger.info("  %d possession phases written", len(phases))


# ---------------------------------------------------------------------------
# Step 4 — Play detection (Spielzugerkennung)
# ---------------------------------------------------------------------------


def detect_play_events(conn: duckdb.DuckDBPyConnection, match_id: str, fps: float) -> None:
    """
    Run the play detectors and write play_events + attack_sequences rows.

    Reads court-mapped player positions (the homography output). Timestamps
    come from the frames table; frame_id / fps is the fallback for frames
    missing there. Goal timestamps from the scoreboard OCR drive the attack
    outcome attribution (Erfolgsquote); without scoreboard data outcomes are
    'unknown'. Public because wels-plays (cli_plays.py) reuses it.
    """
    rows = conn.execute(
        """
        SELECT p.frame_id,
               COALESCE(f.timestamp_s, p.frame_id / ?) AS timestamp_s,
               p.track_id, p.team, p.court_x, p.court_y
        FROM players p
        LEFT JOIN frames f
          ON f.match_id = p.match_id AND f.frame_id = p.frame_id
        WHERE p.match_id = ? AND p.court_x IS NOT NULL AND p.on_court = TRUE
        ORDER BY p.frame_id
        """,
        [fps, match_id],
    ).fetchall()

    row_dicts = [
        {
            "frame_id": int(r[0]),
            "timestamp_s": float(r[1]),
            "track_id": int(r[2]),
            "team": str(r[3]),
            "x": float(r[4]),
            "y": float(r[5]),
        }
        for r in rows
    ]

    # Goal timestamps for outcome attribution — only meaningful when the
    # scoreboard OCR produced readings at all for this match.
    has_scoreboard = (
        conn.execute(
            "SELECT COUNT(*) FROM scoreboard_readings WHERE match_id = ?", [match_id]
        ).fetchone()[0]
        > 0
    )
    goal_times_s: list[float] | None = None
    if has_scoreboard:
        goal_times_s = [
            float(r[0])
            for r in conn.execute(
                "SELECT timestamp_sec FROM goal_events WHERE match_id = ?", [match_id]
            ).fetchall()
        ]

    events, sequences = play_detector.analyze_match(row_dicts, goal_times_s)

    # Idempotent for standalone wels-plays runs (MatchScorer already cleared).
    # Labels reference event_ids, which change on re-scoring — clear them too.
    for table in ("play_events", "attack_sequences", "play_event_labels"):
        conn.execute(f"DELETE FROM {table} WHERE match_id = ?", [match_id])
    if events:
        conn.executemany(
            """
            INSERT INTO play_events
                (match_id, event_id, play_type, team, start_frame, end_frame,
                 start_time_s, end_time_s, confidence, track_ids, details, sequence_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            [
                (
                    match_id,
                    event_id,
                    e.play_type,
                    e.team,
                    e.start_frame,
                    e.end_frame,
                    e.start_time_s,
                    e.end_time_s,
                    e.confidence,
                    json.dumps(e.track_ids),
                    json.dumps(e.details),
                    e.sequence_id,
                )
                for event_id, e in enumerate(events)
            ],
        )
    if sequences:
        conn.executemany(
            """
            INSERT INTO attack_sequences
                (match_id, sequence_id, team, goal_x, start_frame, end_frame,
                 start_time_s, end_time_s, outcome, event_count)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            """,
            [
                (
                    match_id,
                    s.sequence_id,
                    s.team,
                    s.goal_x,
                    s.start_frame,
                    s.end_frame,
                    s.start_time_s,
                    s.end_time_s,
                    s.outcome,
                    s.event_count,
                )
                for s in sequences
            ],
        )
    conn.commit()

    by_type: dict[str, int] = {}
    for e in events:
        by_type[e.play_type] = by_type.get(e.play_type, 0) + 1
    logger.info(
        "  %d play events, %d attack sequences written (%s)",
        len(events),
        len(sequences),
        by_type or "none",
    )


# ---------------------------------------------------------------------------
# Step 5 — Team phases (offense/defense)
# ---------------------------------------------------------------------------


def _detect_team_phases(
    conn: duckdb.DuckDBPyConnection,
    match_id: str,
    fps: float,
) -> None:
    """Write team_phases: offense/defense phases from team centroid positions."""
    frame_rows = conn.execute(
        "SELECT frame_id, timestamp_s FROM frames WHERE match_id = ? ORDER BY frame_id",
        [match_id],
    ).fetchall()
    frame_dicts = [{"frame_id": r[0], "timestamp_s": r[1]} for r in frame_rows]

    # Centroids need a few players to be meaningful — a lone tracked player
    # (e.g. only the goalkeeper detected) would put the centroid anywhere.
    team_avg_x: dict[tuple[int, str], float] = {}
    avg_rows = conn.execute(
        """
        SELECT frame_id, team, AVG(court_x) AS avg_x
        FROM players
        WHERE match_id = ? AND team IN ('A', 'B')
          AND court_x IS NOT NULL AND on_court = TRUE
        GROUP BY frame_id, team
        HAVING COUNT(*) >= 3
        """,
        [match_id],
    ).fetchall()
    for fid, t, avg_x in avg_rows:
        if avg_x is not None:
            team_avg_x[(int(fid), str(t))] = float(avg_x)

    team_phases = detect_team_phases(frame_dicts, team_avg_x, fps=fps)

    if team_phases:
        conn.executemany(
            """
            INSERT INTO team_phases
                (match_id, phase_id, offense_team, defense_team, phase_type,
                 start_frame, end_frame, start_time_s, end_time_s)
            VALUES (?,?,?,?,?,?,?,?,?)
            """,
            [
                (
                    match_id,
                    p.phase_id,
                    p.offense_team,
                    p.defense_team,
                    p.phase_type,
                    p.start_frame,
                    p.end_frame,
                    p.start_time_s,
                    p.end_time_s,
                )
                for p in team_phases
            ],
        )
        conn.commit()

    logger.info("  %d team phases written", len(team_phases))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _clear_match(conn: duckdb.DuckDBPyConnection, match_id: str) -> None:
    """Remove any existing scoring results for this match so re-scoring is safe."""
    for table in (
        "action_predictions",
        "formations",
        "formation_embeddings",
        "formation_scenes",
        "possession_phases",
        "play_events",
        "attack_sequences",
        "play_event_labels",
        "team_phases",
    ):
        conn.execute(f"DELETE FROM {table} WHERE match_id = ?", [match_id])
    conn.commit()
