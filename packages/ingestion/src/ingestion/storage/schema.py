"""
DuckDB schema and connection factory.

All CREATE TABLE statements live here. Call connect() to get a connection
with the schema already applied — safe to call multiple times (IF NOT EXISTS).
"""

import logging
import time
from pathlib import Path

import duckdb

logger = logging.getLogger(__name__)

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS matches (
    match_id       TEXT PRIMARY KEY,
    video_path     TEXT NOT NULL,
    fps            DOUBLE NOT NULL,
    total_frames   INTEGER NOT NULL,
    team_a_name    TEXT,
    team_b_name    TEXT,
    ingested_at    TIMESTAMP DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS frames (
    match_id       TEXT NOT NULL,
    frame_id       INTEGER NOT NULL,
    timestamp_s    DOUBLE NOT NULL,
    player_count   INTEGER NOT NULL,
    on_court_count INTEGER NOT NULL,
    PRIMARY KEY (match_id, frame_id)
);

CREATE TABLE IF NOT EXISTS players (
    match_id       TEXT NOT NULL,
    frame_id       INTEGER NOT NULL,
    track_id       INTEGER NOT NULL,
    team           TEXT NOT NULL,       -- 'A' | 'B' | 'unknown'
    court_x        DOUBLE,              -- NULL when no calibration or out-of-bounds
    court_y        DOUBLE,
    pixel_foot_x   DOUBLE NOT NULL,
    pixel_foot_y   DOUBLE NOT NULL,
    velocity_x     DOUBLE NOT NULL DEFAULT 0,
    velocity_y     DOUBLE NOT NULL DEFAULT 0,
    confidence     DOUBLE NOT NULL,
    on_court       BOOLEAN NOT NULL DEFAULT TRUE,
    has_ball       BOOLEAN NOT NULL DEFAULT FALSE,
    bbox_x1        INTEGER NOT NULL,
    bbox_y1        INTEGER NOT NULL,
    bbox_x2        INTEGER NOT NULL,
    bbox_y2        INTEGER NOT NULL,
    PRIMARY KEY (match_id, frame_id, track_id)
);

CREATE TABLE IF NOT EXISTS ball (
    match_id       TEXT NOT NULL,
    frame_id       INTEGER NOT NULL,
    court_x        DOUBLE,
    court_y        DOUBLE,
    pixel_x        DOUBLE NOT NULL,
    pixel_y        DOUBLE NOT NULL,
    confidence     DOUBLE NOT NULL,
    bbox_x1        INTEGER NOT NULL,
    bbox_y1        INTEGER NOT NULL,
    bbox_x2        INTEGER NOT NULL,
    bbox_y2        INTEGER NOT NULL,
    PRIMARY KEY (match_id, frame_id)
);

CREATE TABLE IF NOT EXISTS action_labels (
    match_id       TEXT NOT NULL,
    frame_id       INTEGER NOT NULL,
    track_id       INTEGER NOT NULL,
    action         TEXT NOT NULL,       -- 'pass' | 'shot' | 'dribble' | 'hold' | ...
    annotator      TEXT NOT NULL DEFAULT 'manual',
    PRIMARY KEY (match_id, frame_id, track_id)
);

CREATE TABLE IF NOT EXISTS scoreboard_readings (
    match_id       VARCHAR NOT NULL,
    frame_number   INTEGER NOT NULL,
    timestamp_sec  DOUBLE NOT NULL,
    game_time      VARCHAR,
    score_home     INTEGER,
    score_away     INTEGER,
    PRIMARY KEY (match_id, frame_number)
);

CREATE TABLE IF NOT EXISTS goal_events (
    match_id       VARCHAR NOT NULL,
    frame_number   INTEGER NOT NULL,
    timestamp_sec  DOUBLE NOT NULL,
    game_time      VARCHAR,
    team           VARCHAR NOT NULL,
    score_home     INTEGER NOT NULL,
    score_away     INTEGER NOT NULL,
    PRIMARY KEY (match_id, frame_number)
);

-- Indexes for the query patterns in ml.data.features
CREATE INDEX IF NOT EXISTS idx_players_match_frame ON players (match_id, frame_id);
CREATE INDEX IF NOT EXISTS idx_ball_match_frame    ON ball    (match_id, frame_id);
CREATE INDEX IF NOT EXISTS idx_labels_action       ON action_labels (action);
"""


def connect(
    db_path: Path,
    read_only: bool = False,
    retries: int = 10,
    delay: float = 2.0,
) -> duckdb.DuckDBPyConnection:
    """
    Open (or create) the DuckDB database and apply the schema.

    Creates parent directories if needed. Safe to call multiple times.
    Retries on IOException (lock conflict with another process, e.g. the backend).
    """
    if not read_only:
        db_path.parent.mkdir(parents=True, exist_ok=True)

    last_error: duckdb.IOException | None = None
    for attempt in range(1, retries + 1):
        try:
            conn = duckdb.connect(str(db_path), read_only=read_only)
            if not read_only:
                conn.execute(_SCHEMA_SQL)
            return conn
        except duckdb.IOException as exc:
            last_error = exc
            if attempt < retries:
                logger.warning(
                    "DuckDB lock conflict (attempt %d/%d), retrying in %.1fs…",
                    attempt,
                    retries,
                    delay,
                )
                time.sleep(delay)

    raise last_error  # type: ignore[misc]
