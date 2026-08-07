"""
Automatic goal detection based on scoreboard score changes.

Reads scoreboard_readings from DuckDB and detects goals by comparing
consecutive score pairs. A goal is registered when exactly one side
increases by +1. OCR outliers (jumps > +1 or score decreases) are
ignored and the previous reference is kept until a plausible reading arrives.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    import duckdb

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class GoalEvent:
    match_id: str
    frame_number: int
    timestamp_sec: float
    game_time: str | None
    team: Literal["home", "away"]
    score_home: int
    score_away: int


def detect_goals(con: duckdb.DuckDBPyConnection, match_id: str) -> list[GoalEvent]:
    """
    Detect goals by comparing consecutive scoreboard readings for match_id.

    Only rows where both score_home and score_away are NOT NULL are considered.
    OCR outliers (any delta other than exactly +1 on one side with 0 on the
    other) are silently skipped and do NOT update the reference values, so the
    detector keeps waiting for the next plausible reading.
    """
    rows = con.execute(
        """
        SELECT frame_number, timestamp_sec, game_time, score_home, score_away
        FROM   scoreboard_readings
        WHERE  match_id = ?
          AND  score_home IS NOT NULL
          AND  score_away IS NOT NULL
        ORDER  BY frame_number
        """,
        [match_id],
    ).fetchall()

    goals: list[GoalEvent] = []
    if not rows:
        return goals

    prev_home: int = rows[0][3]
    prev_away: int = rows[0][4]
    last_known_time: str | None = rows[0][2]  # carry forward last readable game_time

    for frame_number, timestamp_sec, game_time, score_home, score_away in rows[1:]:
        if game_time is not None:
            last_known_time = game_time
        effective_time = game_time or last_known_time

        delta_home = score_home - prev_home
        delta_away = score_away - prev_away

        if delta_home == 1 and delta_away == 0:
            goals.append(
                GoalEvent(
                    match_id=match_id,
                    frame_number=frame_number,
                    timestamp_sec=timestamp_sec,
                    game_time=effective_time,
                    team="home",
                    score_home=score_home,
                    score_away=score_away,
                )
            )
            prev_home, prev_away = score_home, score_away
        elif delta_home == 0 and delta_away == 1:
            goals.append(
                GoalEvent(
                    match_id=match_id,
                    frame_number=frame_number,
                    timestamp_sec=timestamp_sec,
                    game_time=effective_time,
                    team="away",
                    score_home=score_home,
                    score_away=score_away,
                )
            )
            prev_home, prev_away = score_home, score_away
        elif delta_home == 0 and delta_away == 0:
            pass  # stable reading — prev already matches, nothing to do
        # else: OCR outlier — do NOT update prev_home / prev_away

    return goals


def save_goals(con: duckdb.DuckDBPyConnection, goals: list[GoalEvent]) -> None:
    """Create goal_events table if needed and persist all GoalEvents."""
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS goal_events (
            match_id       VARCHAR NOT NULL,
            frame_number   INTEGER NOT NULL,
            timestamp_sec  DOUBLE NOT NULL,
            game_time      VARCHAR,
            team           VARCHAR NOT NULL,
            score_home     INTEGER NOT NULL,
            score_away     INTEGER NOT NULL,
            PRIMARY KEY (match_id, frame_number)
        )
        """
    )
    for goal in goals:
        con.execute(
            """
            INSERT OR REPLACE INTO goal_events
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                goal.match_id,
                goal.frame_number,
                goal.timestamp_sec,
                goal.game_time,
                goal.team,
                goal.score_home,
                goal.score_away,
            ],
        )
