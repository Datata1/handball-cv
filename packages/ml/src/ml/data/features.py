"""
Feature computation from DuckDB.

Velocities and ball-carrier flags are written by the ingestion post-processing step
(orchestrator._compute_velocities / _mark_ball_carrier), so this module focuses on
reading the data in the shape the graph builder expects.

All functions accept a DuckDB connection and return pandas DataFrames or plain dicts.
They are read-only — never write to the database.
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import pandas as pd


def load_frame_window(
    conn: duckdb.DuckDBPyConnection,
    match_id: str,
    center_frame: int,
    window: int = 25,
) -> list[dict]:  # type: ignore[type-arg]
    """
    Load T consecutive frames of player + ball data for graph construction.

    Returns a list of frame dicts, each with keys:
      frame_id, players (list of dicts), ball (dict or None)

    Returns fewer than `window` entries if the match starts before the window.
    """
    start = center_frame - window + 1

    players_df = conn.execute(
        """
        SELECT frame_id, track_id, team,
               court_x, court_y, velocity_x, velocity_y,
               has_ball, confidence
        FROM players
        WHERE match_id = ?
          AND frame_id BETWEEN ? AND ?
          AND court_x IS NOT NULL
        ORDER BY frame_id, track_id
        """,
        [match_id, start, center_frame],
    ).df()

    ball_df = conn.execute(
        """
        SELECT frame_id, court_x, court_y
        FROM ball
        WHERE match_id = ?
          AND frame_id BETWEEN ? AND ?
          AND court_x IS NOT NULL
        ORDER BY frame_id
        """,
        [match_id, start, center_frame],
    ).df()

    frames = []
    for fid in range(start, center_frame + 1):
        p_rows = players_df[players_df["frame_id"] == fid].to_dict("records")
        b_rows = ball_df[ball_df["frame_id"] == fid]
        ball = b_rows.iloc[0].to_dict() if len(b_rows) > 0 else None
        frames.append({"frame_id": fid, "players": p_rows, "ball": ball})

    return frames


def load_training_samples(
    conn: duckdb.DuckDBPyConnection,
    window: int = 25,
) -> pd.DataFrame:
    """
    Return all labeled action windows as a DataFrame with columns:
      match_id, frame_id, track_id, action

    Callers iterate this DataFrame and call load_frame_window() for each row.
    Only returns rows where a full window of data is available.
    """
    return conn.execute(
        """
        SELECT al.match_id, al.frame_id, al.track_id, al.action
        FROM action_labels al
        JOIN frames f ON al.match_id = f.match_id
                     AND al.frame_id = f.frame_id
        WHERE al.frame_id >= ?
        ORDER BY al.match_id, al.frame_id
        """,
        [window - 1],
    ).df()


def open_readonly(db_path: Path) -> duckdb.DuckDBPyConnection:
    return duckdb.connect(str(db_path), read_only=True)
