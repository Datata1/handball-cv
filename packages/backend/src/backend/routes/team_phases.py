"""
Offense/defense team-phase endpoints.

GET /api/v1/matches/{match_id}/team-phases
    Returns offense/defense phases with start/end timestamps, suitable for a
    timeline UI. Written by wels-score (team_phases table); one row per
    possession phase.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend.db import query_duckdb

logger = logging.getLogger(__name__)
router = APIRouter()


class TeamPhaseOut(BaseModel):
    phase_id: int
    offense_team: str
    defense_team: str
    phase_type: str  # "attack" | "transition" | "unclear"
    start_frame: int
    end_frame: int
    start_time_s: float
    end_time_s: float


@router.get("/matches/{match_id}/team-phases", response_model=list[TeamPhaseOut])
async def get_team_phases(
    match_id: str,
    team: str | None = Query(default=None),
    phase_type: str | None = Query(default=None),
) -> list[TeamPhaseOut]:
    """
    Return offense/defense phases for a match, ordered by start_frame.

    Each phase names the offense team (in possession), the defense team, and a
    phase_type refining the offense posture by court position.

    Optional query params:
      ?team=A               — filter to phases where this team is the offense
      ?phase_type=attack    — filter to one phase type
    """
    filters = ["match_id = ?"]
    params: list[object] = [match_id]

    if team is not None:
        filters.append("offense_team = ?")
        params.append(team)
    if phase_type is not None:
        filters.append("phase_type = ?")
        params.append(phase_type)

    where = " AND ".join(filters)
    rows = query_duckdb(
        f"""
        SELECT phase_id, offense_team, defense_team, phase_type,
               start_frame, end_frame, start_time_s, end_time_s
        FROM team_phases
        WHERE {where}
        ORDER BY start_frame
        """,
        params,
    )

    return [
        TeamPhaseOut(
            phase_id=int(r["phase_id"]),
            offense_team=str(r["offense_team"]),
            defense_team=str(r["defense_team"]),
            phase_type=str(r["phase_type"]),
            start_frame=int(r["start_frame"]),
            end_frame=int(r["end_frame"]),
            start_time_s=float(r["start_time_s"]),
            end_time_s=float(r["end_time_s"]),
        )
        for r in rows
    ]
