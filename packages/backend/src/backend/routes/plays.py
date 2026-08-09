"""
Play detection endpoints (Spielzugerkennung).

GET /api/v1/matches/{match_id}/plays
    Returns detected play events with timestamps, confidence, trajectory
    details, attack outcome and coach label. Filterable by play_type and team.

GET /api/v1/matches/{match_id}/play-summary
    Returns event counts per play type and team, plus the attack success rate
    (share of attacks containing that play type which ended in a goal).

GET /api/v1/matches/{match_id}/attacks
    Returns the attack sequences (Angriffe) with outcome and event counts.

POST /api/v1/matches/{match_id}/plays/{event_id}/label
    Stores the coach verdict ('correct' | 'wrong' | null to clear) for a
    detected event — the label loop that feeds a future ML filter.

Data is written by wels-score (step 4) or standalone wels-plays into the
play_events / attack_sequences tables; labels are written here.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Literal

import duckdb
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.config import settings
from backend.db import query_duckdb

logger = logging.getLogger(__name__)
router = APIRouter()


class PlayEvent(BaseModel):
    event_id: int
    play_type: str  # "kreuzen" | "einlaeufer" | "parallelstoss" | "tempogegenstoss"
    team: str  # attacking team: "A" | "B"
    start_frame: int
    end_frame: int
    start_time_s: float
    end_time_s: float
    confidence: float  # heuristic 0..1
    track_ids: list[int]
    details: dict[str, Any] | None  # detector metadata + trajectories for the UI
    sequence_id: int | None = None  # attack sequence the event belongs to
    outcome: str | None = None  # attack outcome: "goal" | "no_goal" | "unknown"
    label: str | None = None  # coach verdict: "correct" | "wrong"


class PlaySummary(BaseModel):
    play_type: str
    team: str
    count: int
    avg_confidence: float
    attacks_rated: int = 0  # attacks containing this play with a known outcome
    attacks_goal: int = 0  # ... of which ended in a goal
    success_rate: float | None = None  # attacks_goal / attacks_rated


class AttackSequence(BaseModel):
    sequence_id: int
    team: str
    goal_x: float
    start_frame: int
    end_frame: int
    start_time_s: float
    end_time_s: float
    outcome: str  # "goal" | "no_goal" | "unknown"
    event_count: int


class PlayLabel(BaseModel):
    verdict: Literal["correct", "wrong"] | None  # null clears the label


@router.get("/matches/{match_id}/plays", response_model=list[PlayEvent])
async def get_plays(
    match_id: str,
    play_type: str | None = Query(default=None),
    team: str | None = Query(default=None),
) -> list[PlayEvent]:
    """
    Return detected play events for a match, ordered by start time.

    Optional query params:
      ?play_type=kreuzen   — filter to one play type
      ?team=A              — filter to one attacking team

    Returns an empty list when no plays were detected (or scoring has not run),
    so the frontend can show its empty state without a 404 special case.
    """
    filters = ["p.match_id = ?"]
    params: list[object] = [match_id]

    if play_type is not None:
        filters.append("p.play_type = ?")
        params.append(play_type)
    if team is not None:
        filters.append("p.team = ?")
        params.append(team)

    where = " AND ".join(filters)
    rows = query_duckdb(
        f"""
        SELECT p.event_id, p.play_type, p.team, p.start_frame, p.end_frame,
               p.start_time_s, p.end_time_s, p.confidence, p.track_ids, p.details,
               p.sequence_id, s.outcome, l.verdict AS label
        FROM play_events p
        LEFT JOIN attack_sequences s
          ON s.match_id = p.match_id AND s.sequence_id = p.sequence_id
        LEFT JOIN play_event_labels l
          ON l.match_id = p.match_id AND l.event_id = p.event_id
        WHERE {where}
        ORDER BY p.start_time_s
        """,
        params,
    )
    if not rows:
        # Older databases may have play_events but not the newer join tables
        # (query_duckdb returns [] on missing tables) — retry without joins.
        rows = query_duckdb(
            f"""
            SELECT p.event_id, p.play_type, p.team, p.start_frame, p.end_frame,
                   p.start_time_s, p.end_time_s, p.confidence, p.track_ids, p.details
            FROM play_events p
            WHERE {where}
            ORDER BY p.start_time_s
            """,
            params,
        )

    return [
        PlayEvent(
            event_id=int(r["event_id"]),
            play_type=str(r["play_type"]),
            team=str(r["team"]),
            start_frame=int(r["start_frame"]),
            end_frame=int(r["end_frame"]),
            start_time_s=float(r["start_time_s"]),
            end_time_s=float(r["end_time_s"]),
            confidence=float(r["confidence"]),
            track_ids=_parse_json(r["track_ids"], default=[]),
            details=_parse_json(r["details"], default=None),
            sequence_id=int(r["sequence_id"]) if r.get("sequence_id") is not None else None,
            outcome=str(r["outcome"]) if r.get("outcome") is not None else None,
            label=str(r["label"]) if r.get("label") is not None else None,
        )
        for r in rows
    ]


@router.get("/matches/{match_id}/play-summary", response_model=list[PlaySummary])
async def get_play_summary(match_id: str) -> list[PlaySummary]:
    """
    Return play frequency per type and team, plus the attack success rate.

    success_rate is the share of attacks (attack_sequences) containing at
    least one event of that play type which ended in a goal — computed only
    over attacks with a known outcome (scoreboard data present).
    """
    rows = query_duckdb(
        """
        SELECT play_type, team, COUNT(*) AS count, AVG(confidence) AS avg_confidence
        FROM play_events
        WHERE match_id = ?
        GROUP BY play_type, team
        ORDER BY play_type, team
        """,
        [match_id],
    )

    # Attack outcomes per play type/team (missing table on old DBs → empty)
    success: dict[tuple[str, str], dict[str, int]] = {}
    for r in query_duckdb(
        """
        SELECT p.play_type, p.team,
               COUNT(DISTINCT CASE WHEN s.outcome IN ('goal','no_goal')
                                   THEN p.sequence_id END) AS attacks_rated,
               COUNT(DISTINCT CASE WHEN s.outcome = 'goal'
                                   THEN p.sequence_id END) AS attacks_goal
        FROM play_events p
        JOIN attack_sequences s
          ON s.match_id = p.match_id AND s.sequence_id = p.sequence_id
        WHERE p.match_id = ?
        GROUP BY p.play_type, p.team
        """,
        [match_id],
    ):
        success[(str(r["play_type"]), str(r["team"]))] = {
            "rated": int(r["attacks_rated"]),
            "goal": int(r["attacks_goal"]),
        }

    summaries = []
    for r in rows:
        key = (str(r["play_type"]), str(r["team"]))
        rated = success.get(key, {}).get("rated", 0)
        goal = success.get(key, {}).get("goal", 0)
        summaries.append(
            PlaySummary(
                play_type=key[0],
                team=key[1],
                count=int(r["count"]),
                avg_confidence=round(float(r["avg_confidence"]), 3),
                attacks_rated=rated,
                attacks_goal=goal,
                success_rate=round(goal / rated, 3) if rated > 0 else None,
            )
        )
    return summaries


@router.get("/matches/{match_id}/attacks", response_model=list[AttackSequence])
async def get_attacks(match_id: str) -> list[AttackSequence]:
    """Return the attack sequences (Angriffe) of a match, ordered by time."""
    rows = query_duckdb(
        """
        SELECT sequence_id, team, goal_x, start_frame, end_frame,
               start_time_s, end_time_s, outcome, event_count
        FROM attack_sequences
        WHERE match_id = ?
        ORDER BY start_time_s
        """,
        [match_id],
    )
    return [
        AttackSequence(
            sequence_id=int(r["sequence_id"]),
            team=str(r["team"]),
            goal_x=float(r["goal_x"]),
            start_frame=int(r["start_frame"]),
            end_frame=int(r["end_frame"]),
            start_time_s=float(r["start_time_s"]),
            end_time_s=float(r["end_time_s"]),
            outcome=str(r["outcome"]),
            event_count=int(r["event_count"]),
        )
        for r in rows
    ]


@router.post("/matches/{match_id}/plays/{event_id}/label")
def set_play_label(match_id: str, event_id: int, body: PlayLabel) -> dict[str, Any]:
    """
    Store or clear the coach verdict for a detected play event.

    Verdicts are the ground truth for tuning thresholds and training the
    planned ML false-positive filter. Written directly (the backend already
    writes to DuckDB for match deletion/metadata).
    """
    db_path = Path(settings.duckdb_path)
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Database not found")

    conn = duckdb.connect(str(db_path))
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS play_event_labels (
                match_id    TEXT    NOT NULL,
                event_id    INTEGER NOT NULL,
                verdict     TEXT    NOT NULL,
                labeled_at  TIMESTAMP DEFAULT current_timestamp,
                PRIMARY KEY (match_id, event_id)
            )
            """
        )
        if body.verdict is None:
            conn.execute(
                "DELETE FROM play_event_labels WHERE match_id = ? AND event_id = ?",
                [match_id, event_id],
            )
        else:
            conn.execute(
                """
                INSERT OR REPLACE INTO play_event_labels (match_id, event_id, verdict)
                VALUES (?, ?, ?)
                """,
                [match_id, event_id, body.verdict],
            )
        conn.commit()
    except duckdb.IOException as exc:
        raise HTTPException(status_code=503, detail=f"Database busy: {exc}") from exc
    finally:
        conn.close()

    return {"ok": True, "event_id": event_id, "verdict": body.verdict}


def _parse_json(value: object, default: Any) -> Any:
    """Tolerant JSON column parser — detection output is trusted but optional."""
    if value is None:
        return default
    try:
        return json.loads(str(value))
    except (json.JSONDecodeError, TypeError):
        return default
