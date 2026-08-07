"""
ML output tables in DuckDB.

These tables are written by wels-score (batch scoring job) and read by the backend.
The core ingestion tables (matches, frames, players, ball, action_labels) are defined
and created by packages/ingestion/src/ingestion/storage/schema.py.

Call connect() to get a writable connection with the ML tables already applied.
"""

from pathlib import Path

import duckdb

_ML_SCHEMA_SQL = """
-- Pre-computed action probabilities for the ball carrier at each frame.
-- Populated by wels-score. Only rows where a ball carrier could be identified
-- and a full window of history existed are included.
CREATE TABLE IF NOT EXISTS action_predictions (
    match_id         TEXT    NOT NULL,
    frame_id         INTEGER NOT NULL,
    track_id         INTEGER NOT NULL,  -- ball carrier at this frame
    pass_prob        DOUBLE  NOT NULL,
    shot_prob        DOUBLE  NOT NULL,
    dribble_prob     DOUBLE  NOT NULL,
    hold_prob        DOUBLE  NOT NULL,
    predicted_action TEXT    NOT NULL,  -- argmax of the four probabilities
    PRIMARY KEY (match_id, frame_id, track_id)
);

-- Rule-based formation label per team per frame.
-- Populated by wels-score regardless of whether a ML checkpoint exists.
CREATE TABLE IF NOT EXISTS formations (
    match_id  TEXT    NOT NULL,
    frame_id  INTEGER NOT NULL,
    team      TEXT    NOT NULL,   -- 'A' | 'B'
    formation TEXT    NOT NULL,   -- see analysis/formation.py for labels
    PRIMARY KEY (match_id, frame_id, team)
);

-- Continuous possession phases: one row per uninterrupted possession sequence.
-- Derived from the per-frame has_ball column; short interruptions are smoothed out.
CREATE TABLE IF NOT EXISTS possession_phases (
    match_id      TEXT    NOT NULL,
    phase_id      INTEGER NOT NULL,
    team          TEXT    NOT NULL,
    start_frame   INTEGER NOT NULL,
    end_frame     INTEGER NOT NULL,
    start_time_s  DOUBLE  NOT NULL,
    end_time_s    DOUBLE  NOT NULL,
    PRIMARY KEY (match_id, phase_id)
);

CREATE INDEX IF NOT EXISTS idx_action_pred_match_frame
    ON action_predictions (match_id, frame_id);

CREATE INDEX IF NOT EXISTS idx_formations_match_frame
    ON formations (match_id, frame_id);

CREATE INDEX IF NOT EXISTS idx_possession_match
    ON possession_phases (match_id, start_frame);

-- Contrastive formation embeddings: one 128-dim vector per team per frame.
-- Written by wels-score when a formation encoder checkpoint is present.
-- The formation column mirrors the formations table but uses the contrastive
-- k-NN classifier instead of rule-based thresholds — more robust to noisy
-- homography output and missed player detections.
CREATE TABLE IF NOT EXISTS formation_embeddings (
    match_id   TEXT    NOT NULL,
    frame_id   INTEGER NOT NULL,
    team       TEXT    NOT NULL,
    formation  TEXT    NOT NULL,   -- k-NN label from ContrastiveFormationClassifier
    emb_0      FLOAT   NOT NULL,   -- first two dims stored for quick scatter plots
    emb_1      FLOAT   NOT NULL,
    PRIMARY KEY (match_id, frame_id, team)
);

CREATE INDEX IF NOT EXISTS idx_formation_emb_match_frame
    ON formation_embeddings (match_id, frame_id);

-- Continuous formation scenes: one row per uninterrupted sequence of the same
-- formation label. Derived from the per-frame formations table after scoring.
-- Short runs (< _MIN_SCENE_FRAMES actual frames) are excluded to filter noise.
CREATE TABLE IF NOT EXISTS formation_scenes (
    match_id      TEXT    NOT NULL,
    scene_id      INTEGER NOT NULL,
    team          TEXT    NOT NULL,
    formation     TEXT    NOT NULL,
    start_frame   INTEGER NOT NULL,
    end_frame     INTEGER NOT NULL,
    start_time_s  DOUBLE  NOT NULL,
    end_time_s    DOUBLE  NOT NULL,
    PRIMARY KEY (match_id, scene_id)
);

CREATE INDEX IF NOT EXISTS idx_formation_scenes_match
    ON formation_scenes (match_id, formation, team);

-- Detected offensive plays (Spielzugerkennung, rule-based — see analysis/plays.py).
-- One row per detected play with start/end timestamps for video seeking.
-- track_ids is a JSON array of involved track ids; details is a JSON object
-- with detector metadata and downsampled trajectories for the frontend
-- field visualisation ({"goal_x": …, "tracks": [{"track_id", "points": [[t,x,y],…]}]}).
CREATE TABLE IF NOT EXISTS play_events (
    match_id      TEXT    NOT NULL,
    event_id      INTEGER NOT NULL,
    play_type     TEXT    NOT NULL,   -- 'kreuzen' | 'einlaeufer' | 'parallelstoss' | 'tempogegenstoss'
    team          TEXT    NOT NULL,   -- attacking team: 'A' | 'B'
    start_frame   INTEGER NOT NULL,
    end_frame     INTEGER NOT NULL,
    start_time_s  DOUBLE  NOT NULL,
    end_time_s    DOUBLE  NOT NULL,
    confidence    DOUBLE  NOT NULL,   -- heuristic 0..1
    track_ids     TEXT    NOT NULL,   -- JSON array
    details       TEXT,               -- JSON object
    PRIMARY KEY (match_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_play_events_match
    ON play_events (match_id, play_type, team);

-- Attack sequences (Angriffe): one row per positional attack, derived from
-- the attack contexts in analysis/plays.py. outcome links the attack to the
-- scoreboard goal events ('unknown' when no scoreboard data exists).
-- play_events.sequence_id references attack_sequences.sequence_id.
CREATE TABLE IF NOT EXISTS attack_sequences (
    match_id      TEXT    NOT NULL,
    sequence_id   INTEGER NOT NULL,
    team          TEXT    NOT NULL,   -- attacking team 'A' | 'B'
    goal_x        DOUBLE  NOT NULL,   -- attacked goal: 0 or 40
    start_frame   INTEGER NOT NULL,
    end_frame     INTEGER NOT NULL,
    start_time_s  DOUBLE  NOT NULL,
    end_time_s    DOUBLE  NOT NULL,
    outcome       TEXT    NOT NULL,   -- 'goal' | 'no_goal' | 'unknown'
    event_count   INTEGER NOT NULL,
    PRIMARY KEY (match_id, sequence_id)
);

-- Coach verdicts on detected play events (label loop). Written by the
-- backend (frontend ✓/✗ buttons); training data for a future ML filter.
-- Cleared together with play_events on re-scoring: event_ids change.
CREATE TABLE IF NOT EXISTS play_event_labels (
    match_id    TEXT    NOT NULL,
    event_id    INTEGER NOT NULL,
    verdict     TEXT    NOT NULL,    -- 'correct' | 'wrong'
    labeled_at  TIMESTAMP DEFAULT current_timestamp,
    PRIMARY KEY (match_id, event_id)
);

-- Offense/defense phases detected from team centroid positions (homography):
-- in established play the defending team's centroid is closer to the goal the
-- play clusters around. Independent of ball detection (has_ball). Unlabelled
-- stretches between phases are transition / unclear play.
CREATE TABLE IF NOT EXISTS team_phases (
    match_id      TEXT    NOT NULL,
    phase_id      INTEGER NOT NULL,
    offense_team  TEXT    NOT NULL,   -- 'A' | 'B'
    defense_team  TEXT    NOT NULL,
    phase_type    TEXT    NOT NULL,   -- 'attack' (established play near one goal)
    start_frame   INTEGER NOT NULL,
    end_frame     INTEGER NOT NULL,
    start_time_s  DOUBLE  NOT NULL,
    end_time_s    DOUBLE  NOT NULL,
    PRIMARY KEY (match_id, phase_id)
);

CREATE INDEX IF NOT EXISTS idx_team_phases_match
    ON team_phases (match_id, start_frame);
"""

# Idempotent migrations for columns added after the initial table creation
_ML_MIGRATIONS_SQL = """
ALTER TABLE play_events ADD COLUMN IF NOT EXISTS sequence_id INTEGER;
"""


def connect(db_path: Path) -> duckdb.DuckDBPyConnection:
    """
    Open the DuckDB database for reading and writing ML output tables.
    Creates ML tables if they don't exist yet (idempotent).
    The file must already exist — run wels-ingest first.
    """
    if not db_path.exists():
        raise FileNotFoundError(
            f"Database not found: {db_path}\nRun wels-ingest on a match video first."
        )
    conn = duckdb.connect(str(db_path))
    conn.execute(_ML_SCHEMA_SQL)
    conn.execute(_ML_MIGRATIONS_SQL)
    return conn
