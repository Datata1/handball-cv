"""
Formation analysis endpoints.

GET /api/v1/matches/{match_id}/formations
    Returns per-frame formation labels for both teams (rule-based or contrastive).

GET /api/v1/matches/{match_id}/formation-summary
    Returns formation frequency distribution for the match.

GET /api/v1/matches/{match_id}/formation-scenes
    Returns aggregated formation scenes with start/end timestamps.
"""

from __future__ import annotations

import logging
from collections import Counter

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.db import query_duckdb

logger = logging.getLogger(__name__)
router = APIRouter()


class FormationFrame(BaseModel):
    frame_id: int
    team: str
    formation: str
    source: str  # "contrastive" | "rule-based" | "unknown"


class FormationSummary(BaseModel):
    team: str
    formations: dict[str, int]  # formation label → frame count
    dominant: str  # most frequent formation


class FormationScene(BaseModel):
    scene_id: int
    team: str
    formation: str
    start_frame: int
    end_frame: int
    start_time_s: float
    end_time_s: float


@router.get("/matches/{match_id}/formations", response_model=list[FormationFrame])
async def get_formations(match_id: str) -> list[FormationFrame]:
    """
    Return formation labels per frame per team.

    Prefers contrastive embeddings (formation_embeddings table) when available;
    falls back to rule-based labels from the formations table.
    """
    # Try contrastive table first
    rows = query_duckdb(
        """
        SELECT frame_id, team, formation, 'contrastive' AS source
        FROM formation_embeddings
        WHERE match_id = ?
        ORDER BY frame_id, team
        """,
        [match_id],
    )

    if not rows:
        # Fall back to rule-based
        rows = query_duckdb(
            """
            SELECT frame_id, team, formation, 'rule-based' AS source
            FROM formations
            WHERE match_id = ?
            ORDER BY frame_id, team
            """,
            [match_id],
        )

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No formation data for match '{match_id}'. Run wels-score first.",
        )

    return [
        FormationFrame(
            frame_id=int(r["frame_id"]),
            team=str(r["team"]),
            formation=str(r["formation"]),
            source=str(r["source"]),
        )
        for r in rows
    ]


@router.get("/matches/{match_id}/formation-summary", response_model=list[FormationSummary])
async def get_formation_summary(match_id: str) -> list[FormationSummary]:
    """Return formation frequency distribution per team for the match."""
    frames = await get_formations(match_id)

    by_team: dict[str, list[str]] = {}
    for f in frames:
        by_team.setdefault(f.team, []).append(f.formation)

    summaries = []
    for team, labels in sorted(by_team.items()):
        counts = dict(Counter(labels))
        dominant = max(counts, key=lambda k: counts[k])
        summaries.append(FormationSummary(team=team, formations=counts, dominant=dominant))

    return summaries


@router.get("/matches/{match_id}/formation-scenes", response_model=list[FormationScene])
async def get_formation_scenes(
    match_id: str,
    team: str | None = Query(default=None),
    formation: str | None = Query(default=None),
) -> list[FormationScene]:
    """
    Return aggregated formation scenes for a match.

    Each scene is an uninterrupted run of the same formation label for one team,
    with start/end timestamps suitable for video seeking.

    Optional query params:
      ?team=A          — filter to one team
      ?formation=6-0   — filter to one formation label
    """
    filters = ["match_id = ?"]
    params: list[object] = [match_id]

    if team is not None:
        filters.append("team = ?")
        params.append(team)
    if formation is not None:
        filters.append("formation = ?")
        params.append(formation)

    where = " AND ".join(filters)
    rows = query_duckdb(
        f"""
        SELECT scene_id, team, formation, start_frame, end_frame, start_time_s, end_time_s
        FROM formation_scenes
        WHERE {where}
        ORDER BY start_frame, team
        """,
        params,
    )

    return [
        FormationScene(
            scene_id=int(r["scene_id"]),
            team=str(r["team"]),
            formation=str(r["formation"]),
            start_frame=int(r["start_frame"]),
            end_frame=int(r["end_frame"]),
            start_time_s=float(r["start_time_s"]),
            end_time_s=float(r["end_time_s"]),
        )
        for r in rows
    ]
