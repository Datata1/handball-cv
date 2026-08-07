import asyncio
import json
import logging
from pathlib import Path
from typing import Any, TypedDict, cast

import cv2
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from backend.config import settings
from backend.db import query_duckdb
from backend.meta import read_meta, write_meta
from backend.status import all_statuses, read_status, subscribe, unsubscribe, write_status
from backend.types import GoalEvent, MatchMeta, ScoreboardSummary

THUMBNAIL_FRAME_INDEX = 42

logger = logging.getLogger(__name__)
router = APIRouter()


class _HeatmapRow(TypedDict):
    zone: str
    cnt: int


class _TeamHeatmapRow(TypedDict):
    team: str
    zone: str
    cnt: int


class _HeatmapPointRow(TypedDict):
    x: float
    y: float
    team: str


def _coerce_heatmap_rows(rows: list[dict[str, object]]) -> list[_HeatmapRow]:
    normalized: list[_HeatmapRow] = []
    for row in rows:
        zone = row.get("zone")
        cnt = row.get("cnt")
        if zone is None or cnt is None:
            continue
        normalized.append({"zone": str(zone), "cnt": int(cast(Any, cnt))})
    return normalized


def _coerce_team_heatmap_rows(rows: list[dict[str, object]]) -> list[_TeamHeatmapRow]:
    normalized: list[_TeamHeatmapRow] = []
    for row in rows:
        team = row.get("team")
        zone = row.get("zone")
        cnt = row.get("cnt")
        if team is None or zone is None or cnt is None:
            continue
        normalized.append({"team": str(team), "zone": str(zone), "cnt": int(cast(Any, cnt))})
    return normalized


def _coerce_heatmap_point_rows(rows: list[dict[str, object]]) -> list[_HeatmapPointRow]:
    normalized: list[_HeatmapPointRow] = []
    for row in rows:
        x = row.get("x")
        y = row.get("y")
        team = row.get("team")
        if x is None or y is None or team is None:
            continue
        normalized.append({"x": float(cast(Any, x)), "y": float(cast(Any, y)), "team": str(team)})
    return normalized


def get_absolute_video_path(db_path: str) -> Path:
    """Helper: Löst den absoluten Pfad des Videos auf."""
    video_path = Path(db_path)
    if not video_path.is_absolute():
        video_path = Path(settings.video_input_dir) / video_path
    return video_path


def extract_frame_as_jpeg(video_path: Path, frame_index: int) -> bytes:
    """Helper: Extrahiert sicher einen Frame aus einem Video via OpenCV."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail="Could not open video file")

    try:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ret, frame = cap.read()
        if not ret:
            raise ValueError("Konnte Frame nicht lesen")

        success, buffer = cv2.imencode(".jpg", frame)
        if not success:
            raise HTTPException(status_code=500, detail="Could not encode frame to JPEG")

        return buffer.tobytes()
    finally:
        cap.release()


@router.get("/status/stream")
async def status_stream() -> StreamingResponse:
    """Server-Sent Events stream: pushes a 'status' event whenever a match
    transitions to a new pipeline state (processing → done / failed).
    Clients connect once and receive push notifications instead of polling."""
    queue = subscribe()

    async def generator():
        try:
            yield "event: connected\ndata: {}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=25)
                    yield f"event: status\ndata: {json.dumps(event)}\n\n"
                except TimeoutError:
                    yield ": heartbeat\n\n"
        except GeneratorExit:
            pass
        finally:
            unsubscribe(queue)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/matches", response_model=list[MatchMeta])
def list_matches():
    """Returns all matches — both completed (from DuckDB) and in-progress (from status files)."""
    rows = list(query_duckdb("SELECT * FROM matches"))
    result: list[MatchMeta] = []
    seen_ids: set[str] = set()

    for row in rows:
        video_path = get_absolute_video_path(row["video_path"])

        if not video_path.exists():
            logger.debug("Video file missing for match_id %s at %s", row["match_id"], video_path)
            continue

        fps = row.get("fps") or 1.0
        total_seconds = int(row.get("total_frames", 0) / fps)
        mins, secs = divmod(total_seconds, 60)

        date_str = row["ingested_at"].isoformat() if row.get("ingested_at") else None
        status = read_status(row["match_id"])
        # Data is already in DuckDB → ingestion completed. Heal stale/missing status files
        # so future query_duckdb calls aren't blocked by an orphaned "processing" entry.
        if status in ("unknown", "processing"):
            status = "done"
            write_status(row["match_id"], "done")

        meta = read_meta(row["match_id"])
        seen_ids.add(row["match_id"])
        result.append(
            MatchMeta(
                match_id=row["match_id"],
                file_name=video_path.name,
                video_path=str(video_path),
                fps=row["fps"],
                total_frames=row["total_frames"],
                duration=f"{mins:02d}:{secs:02d}",
                date=date_str,
                ingested_at=date_str,
                status=status,
                display_name=meta.get("display_name"),
                team_a_name=meta.get("team_a_name"),
                team_b_name=meta.get("team_b_name"),
            )
        )

    # Surface matches that have a status file but aren't in DuckDB yet
    # (e.g. still processing, or failed before DuckDB write)
    for match_id, status in all_statuses().items():
        if match_id in seen_ids:
            continue
        result.append(
            MatchMeta(
                match_id=match_id,
                file_name="",
                video_path="",
                fps=0.0,
                total_frames=0,
                status=status,
            )
        )

    return result


class MatchPatch(BaseModel):
    display_name: str | None = None
    team_a_name: str | None = None
    team_b_name: str | None = None


@router.patch("/matches/{match_id}")
def update_match(match_id: str, body: MatchPatch) -> dict[str, bool]:
    """Update editable metadata for a match (name and team names)."""
    update = body.model_dump(exclude_none=True)
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    write_meta(match_id, update)
    return {"ok": True}


@router.delete("/matches/{match_id}", status_code=200)
def delete_match(match_id: str) -> dict[str, bool | str]:
    """
    Remove a match from the UI.

    Deletes: output video, status/meta sidecar files, and the input video if it
    was uploaded via the frontend (lives in DATA_INPUT_VIDEOS).

    The bulk tracking data (frames, players, formations, …) is kept in DuckDB —
    it took significant compute to generate and is small compared to video files.
    Only the matches row itself is removed so the entry no longer appears in the list.
    """
    import duckdb as _duckdb

    from backend.meta import META_DIR
    from backend.routes.upload import DATA_INPUT_VIDEOS, DATA_OUTPUT_VIDEOS
    from backend.status import STATUS_DIR

    rows = query_duckdb("SELECT video_path FROM matches WHERE match_id = ?", [match_id])
    if not rows:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' not found")

    stored_video_path = rows[0]["video_path"]
    db_path = Path(settings.duckdb_path)

    # Remove only the matches row so the entry disappears from the list
    conn = _duckdb.connect(str(db_path))
    try:
        conn.execute("DELETE FROM matches WHERE match_id = ?", [match_id])
        conn.commit()
    finally:
        conn.close()

    # Output annotated video
    output_video = DATA_OUTPUT_VIDEOS / f"{match_id}_annotated.mp4"
    if output_video.exists():
        output_video.unlink()

    # Status file
    status_file = STATUS_DIR / f"{match_id}.status"
    if status_file.exists():
        status_file.unlink()

    # Meta JSON
    meta_file = META_DIR / f"{match_id}.json"
    if meta_file.exists():
        meta_file.unlink()

    # Input video — only delete if it was uploaded via the frontend (lives inside DATA_INPUT_VIDEOS)
    abs_video = get_absolute_video_path(stored_video_path)
    try:
        if abs_video.exists() and abs_video.is_relative_to(DATA_INPUT_VIDEOS):
            abs_video.unlink()
    except ValueError:
        pass

    return {"ok": True, "deleted": match_id}


@router.get("/matches/{match_id}/stats")
def get_match_stats(match_id: str):
    """Returns real tracking statistics for a completed match."""
    rows = query_duckdb("SELECT fps, total_frames FROM matches WHERE match_id = ?", [match_id])
    if not rows:
        raise HTTPException(status_code=404, detail="Match not found or database not accessible")

    fps = rows[0]["fps"] or 25.0
    total_frames = rows[0]["total_frames"] or 0

    def _scalar(q: str, *params: object) -> int:
        r = query_duckdb(q, list(params))
        return int(r[0]["n"]) if r else 0

    players_detected = _scalar(
        "SELECT COUNT(DISTINCT track_id) AS n FROM players WHERE match_id = ?", match_id
    )
    player_frames = _scalar(
        "SELECT COUNT(DISTINCT frame_id) AS n FROM players WHERE match_id = ?", match_id
    )
    field_frames = _scalar(
        """
        SELECT COUNT(DISTINCT frame_id) AS n
        FROM players
        WHERE match_id = ? AND court_x IS NOT NULL AND court_y IS NOT NULL
        """,
        match_id,
    )
    ball_frames = _scalar("SELECT COUNT(*) AS n FROM ball WHERE match_id = ?", match_id)

    player_detection_rate = round(player_frames / total_frames * 100, 1) if total_frames else 0.0
    field_detection_rate = round(field_frames / total_frames * 100, 1) if total_frames else 0.0
    ball_detection_rate = round(ball_frames / total_frames * 100, 1) if total_frames else 0.0

    poss_rows = query_duckdb(
        "SELECT team, COUNT(*) AS n FROM players WHERE match_id = ? AND has_ball = TRUE GROUP BY team",
        [match_id],
    )
    poss_total = sum(r["n"] for r in poss_rows)
    possession_a = 0.0
    possession_b = 0.0
    if poss_total:
        for r in poss_rows:
            if r["team"] == "A":
                possession_a = round(r["n"] / poss_total * 100, 1)
            elif r["team"] == "B":
                possession_b = round(r["n"] / poss_total * 100, 1)

    ps_rows = query_duckdb(
        """
        SELECT
            track_id,
            ANY_VALUE(team)                                                         AS team,
            COUNT(*)                                                                AS frame_count,
            ROUND(AVG(confidence) * 100, 1)                                        AS avg_confidence_pct,
            ROUND(SUM(SQRT(velocity_x * velocity_x + velocity_y * velocity_y))
                  / NULLIF(?, 0), 1)                                               AS distance_m
        FROM players
        WHERE match_id = ?
        GROUP BY track_id
        ORDER BY frame_count DESC
        LIMIT 25
        """,
        [fps, match_id],
    )

    # Heatmap: count player appearances per handball zone, split by court half.
    # Zones are oriented relative to the attacked goal on each side.
    # Left half (goal at x=0): facing x=0 → left=high y, right=low y
    # Right half (goal at x=40): facing x=40 → left=low y, right=high y
    _zone_order = ["LA", "RL", "RM", "RR", "RA", "KL"]
    _zone_labels = {
        "LA": "Linksaußen",
        "RL": "Rückraum links",
        "RM": "Rückraum Mitte",
        "RR": "Rückraum rechts",
        "RA": "Rechtsaußen",
        "KL": "Kreisläufer",
    }

    def _build_heatmap(rows: list[_HeatmapRow]) -> list[dict[str, object]]:
        max_cnt = max((r["cnt"] for r in rows), default=0)
        zone_map = {r["zone"]: r["cnt"] for r in rows}
        return [
            {
                "zone": code,
                "label": _zone_labels[code],
                "intensity": round(zone_map.get(code, 0) / max_cnt * 100, 1) if max_cnt else 0.0,
            }
            for code in _zone_order
        ]

    def _build_team_heatmap(rows: list[_TeamHeatmapRow]) -> dict[str, list[dict[str, object]]]:
        by_team: dict[str, dict[str, int]] = {"A": {}, "B": {}, "U": {}}
        for row in rows:
            team = row["team"]
            if team not in by_team:
                continue
            zone = row["zone"]
            by_team[team][zone] = row["cnt"]

        result: dict[str, list[dict[str, object]]] = {}
        for team in ("A", "B", "U"):
            result[team] = [
                {
                    "team": team,
                    "zone": code,
                    "label": _zone_labels[code],
                    "count": by_team[team].get(code, 0),
                }
                for code in _zone_order
            ]
        return result

    left_rows = query_duckdb(
        """
        SELECT
            CASE
                WHEN court_x < 7 AND court_y BETWEEN 5 AND 15 THEN 'KL'
                WHEN court_x < 12 AND court_y >= 15            THEN 'LA'
                WHEN court_x < 12 AND court_y <= 5             THEN 'RA'
                WHEN court_y > 12                              THEN 'RL'
                WHEN court_y < 8                               THEN 'RR'
                ELSE 'RM'
            END AS zone,
            COUNT(*) AS cnt
        FROM players
        WHERE match_id = ? AND court_x IS NOT NULL AND court_x < 20
        GROUP BY zone
        """,
        [match_id],
    )
    right_rows = query_duckdb(
        """
        SELECT
            CASE
                WHEN court_x > 33 AND court_y BETWEEN 5 AND 15 THEN 'KL'
                WHEN court_x > 28 AND court_y <= 5              THEN 'LA'
                WHEN court_x > 28 AND court_y >= 15             THEN 'RA'
                WHEN court_y < 8                                THEN 'RL'
                WHEN court_y > 12                               THEN 'RR'
                ELSE 'RM'
            END AS zone,
            COUNT(*) AS cnt
        FROM players
        WHERE match_id = ? AND court_x IS NOT NULL AND court_x >= 20
        GROUP BY zone
        """,
        [match_id],
    )
    left_team_rows = query_duckdb(
        """
        SELECT
            CASE WHEN team IN ('A', 'B') THEN team ELSE 'U' END AS team,
            CASE
                WHEN court_x < 7 AND court_y BETWEEN 5 AND 15 THEN 'KL'
                WHEN court_x < 12 AND court_y >= 15            THEN 'LA'
                WHEN court_x < 12 AND court_y <= 5             THEN 'RA'
                WHEN court_y > 12                              THEN 'RL'
                WHEN court_y < 8                               THEN 'RR'
                ELSE 'RM'
            END AS zone,
            COUNT(*) AS cnt
        FROM players
        WHERE match_id = ? AND court_x IS NOT NULL AND court_x < 20
        GROUP BY team, zone
        """,
        [match_id],
    )
    right_team_rows = query_duckdb(
        """
        SELECT
            CASE WHEN team IN ('A', 'B') THEN team ELSE 'U' END AS team,
            CASE
                WHEN court_x > 33 AND court_y BETWEEN 5 AND 15 THEN 'KL'
                WHEN court_x > 28 AND court_y <= 5              THEN 'LA'
                WHEN court_x > 28 AND court_y >= 15             THEN 'RA'
                WHEN court_y < 8                                THEN 'RL'
                WHEN court_y > 12                               THEN 'RR'
                ELSE 'RM'
            END AS zone,
            COUNT(*) AS cnt
        FROM players
        WHERE match_id = ? AND court_x IS NOT NULL AND court_x >= 20
        GROUP BY team, zone
        """,
        [match_id],
    )
    heatmap_point_rows = query_duckdb(
        """
        SELECT
            court_x AS x,
            court_y AS y,
            CASE WHEN team IN ('A', 'B') THEN team ELSE 'U' END AS team
        FROM players
        WHERE
            match_id = ?
            AND court_x IS NOT NULL
            AND court_y IS NOT NULL
            AND court_x BETWEEN 0 AND 40
            AND court_y BETWEEN 0 AND 20
            AND (frame_id % 100) = 0
        ORDER BY frame_id
        LIMIT 12000
        """,
        [match_id],
    )

    return {
        "match_id": match_id,
        "total_frames": total_frames,
        "fps": fps,
        "duration_seconds": round(total_frames / fps, 1) if fps else 0.0,
        "players_detected": players_detected,
        "ball_detection_rate": ball_detection_rate,
        "player_detection_rate": player_detection_rate,
        "field_detection_rate": field_detection_rate,
        "possession_a": possession_a,
        "possession_b": possession_b,
        "player_stats": [
            {
                "track_id": r["track_id"],
                "team": r["team"],
                "frame_count": r["frame_count"],
                "avg_confidence_pct": float(r["avg_confidence_pct"] or 0),
                "distance_m": float(r["distance_m"] or 0),
            }
            for r in ps_rows
        ],
        "heatmap_left": _build_heatmap(_coerce_heatmap_rows(left_rows)),
        "heatmap_right": _build_heatmap(_coerce_heatmap_rows(right_rows)),
        "heatmap_left_by_team": _build_team_heatmap(_coerce_team_heatmap_rows(left_team_rows)),
        "heatmap_right_by_team": _build_team_heatmap(_coerce_team_heatmap_rows(right_team_rows)),
        "heatmap_points": _coerce_heatmap_point_rows(heatmap_point_rows),
    }


@router.get("/matches/{match_id}/heatmap-points")
def get_heatmap_points(
    match_id: str,
    phase_id: int | None = Query(default=None),
    track_ids: str | None = Query(default=None),
    perspective: str = Query(default="both"),
    window_start_s: float | None = Query(default=None),
    window_end_s: float | None = Query(default=None),
):
    """Unified heatmap point cloud endpoint.

    Returns player position data for the entire match or a specific phase.
    Supports filtering by track IDs, perspective (phase only), and time window.

    Optional query params:
      ?phase_id=3                    — filter to a specific team phase
      ?track_ids=1,3,7               — filter to specific player track IDs
      ?perspective=offense|defense   — filter by team role (requires phase_id)
      ?window_start_s=120.5&window_end_s=125.5  — time window in seconds
    """
    fps_row = query_duckdb(
        "SELECT fps, total_frames FROM matches WHERE match_id = ?",
        [match_id],
    )
    if not fps_row:
        raise HTTPException(status_code=404, detail="Match not found")
    fps = float(fps_row[0]["fps"]) if fps_row[0]["fps"] else 25.0
    total_frames = int(fps_row[0]["total_frames"]) if fps_row[0]["total_frames"] else 0

    # --- Track IDs filter (shared) ---
    track_ids_params: list[int] = []
    track_filter = ""
    if track_ids:
        ids = [int(t.strip()) for t in track_ids.split(",") if t.strip()]
        if ids:
            placeholders = ", ".join("?" for _ in ids)
            track_filter = f" AND p.track_id IN ({placeholders})"
            track_ids_params = ids

    if phase_id is not None:
        # ── Phase-specific query ──────────────────────────────────────────
        phase_rows = query_duckdb(
            """SELECT phase_id, offense_team, defense_team, phase_type,
                      start_frame, end_frame, start_time_s, end_time_s
               FROM team_phases
               WHERE match_id = ? AND phase_id = ?""",
            [match_id, phase_id],
        )
        if not phase_rows:
            raise HTTPException(status_code=404, detail="Phase not found")
        p = phase_rows[0]

        phase_start_frame = int(p["start_frame"])
        phase_end_frame = int(p["end_frame"])
        phase_start_time = float(p["start_time_s"])
        phase_end_time = float(p["end_time_s"])
        phase_frame_count = phase_end_frame - phase_start_frame
        phase_duration = phase_end_time - phase_start_time

        # Time-window clamped to phase bounds
        window_filter = ""
        if window_start_s is not None and window_end_s is not None:
            win_start = max(window_start_s, phase_start_time)
            win_end = min(window_end_s, phase_end_time)
            if phase_duration > 0 and phase_frame_count > 0:
                ratio = phase_frame_count / phase_duration
                f_start = int(phase_start_frame + (win_start - phase_start_time) * ratio)
                f_end = int(phase_start_frame + (win_end - phase_start_time) * ratio)
                window_filter = f" AND p.frame_id BETWEEN {f_start} AND {f_end}"

        # Perspective filter (only meaningful within a phase)
        perspective_filter = ""
        if perspective == "offense":
            perspective_filter = " AND p.team = tp.offense_team"
        elif perspective == "defense":
            perspective_filter = " AND p.team = tp.defense_team"

        base_params = [match_id, phase_id]

        available_tracks = query_duckdb(
            f"""SELECT p.track_id, p.team,
                       MIN(p.frame_id) AS first_frame,
                       MAX(p.frame_id) AS last_frame,
                       COUNT(*) AS frame_count
                FROM players p
                JOIN team_phases tp
                    ON  p.match_id = tp.match_id
                    AND p.frame_id BETWEEN tp.start_frame AND tp.end_frame
                WHERE p.match_id = ? AND tp.phase_id = ?
                  AND p.court_x IS NOT NULL AND p.court_y IS NOT NULL
                  {perspective_filter} {window_filter}
                GROUP BY p.track_id, p.team
                ORDER BY p.track_id""",
            base_params,
        )

        params = base_params + track_ids_params
        points = query_duckdb(
            f"""SELECT p.court_x AS x, p.court_y AS y, p.track_id,
                       CASE WHEN p.team IN ('A', 'B') THEN p.team ELSE 'U' END AS team
                FROM players p
                JOIN team_phases tp
                    ON  p.match_id = tp.match_id
                    AND p.frame_id BETWEEN tp.start_frame AND tp.end_frame
                WHERE p.match_id = ? AND tp.phase_id = ?
                  AND p.court_x IS NOT NULL AND p.court_y IS NOT NULL
                  AND p.court_x BETWEEN 0 AND 40 AND p.court_y BETWEEN 0 AND 20
                  AND (p.frame_id % 100) = 0
                  {perspective_filter} {window_filter} {track_filter}
                ORDER BY p.frame_id
                LIMIT 12000""",
            params,
        )
    else:
        # ── Global match query ────────────────────────────────────────────
        window_filter = ""
        if window_start_s is not None and window_end_s is not None:
            f_start = max(0, int(window_start_s * fps))
            f_end = min(total_frames, int(window_end_s * fps))
            window_filter = f" AND p.frame_id BETWEEN {f_start} AND {f_end}"

        # Perspective filter in global mode: join team_phases to determine
        # offense/defense per frame across the whole match.
        perspective_join = ""
        perspective_cond = ""
        if perspective == "offense":
            perspective_join = """JOIN team_phases tp
                ON  p.match_id = tp.match_id
                AND p.frame_id BETWEEN tp.start_frame AND tp.end_frame"""
            perspective_cond = " AND p.team = tp.offense_team"
        elif perspective == "defense":
            perspective_join = """JOIN team_phases tp
                ON  p.match_id = tp.match_id
                AND p.frame_id BETWEEN tp.start_frame AND tp.end_frame"""
            perspective_cond = " AND p.team = tp.defense_team"

        base_params = [match_id]

        available_tracks = query_duckdb(
            f"""SELECT p.track_id, p.team,
                       MIN(p.frame_id) AS first_frame,
                       MAX(p.frame_id) AS last_frame,
                       COUNT(*) AS frame_count
                FROM players p
                {perspective_join}
                WHERE p.match_id = ?
                  AND p.court_x IS NOT NULL AND p.court_y IS NOT NULL
                  {perspective_cond} {window_filter}
                GROUP BY p.track_id, p.team
                ORDER BY p.track_id""",
            base_params,
        )

        params = base_params + track_ids_params
        points = query_duckdb(
            f"""SELECT p.court_x AS x, p.court_y AS y, p.track_id,
                       CASE WHEN p.team IN ('A', 'B') THEN p.team ELSE 'U' END AS team
                FROM players p
                {perspective_join}
                WHERE p.match_id = ?
                  AND p.court_x IS NOT NULL AND p.court_y IS NOT NULL
                  AND p.court_x BETWEEN 0 AND 40 AND p.court_y BETWEEN 0 AND 20
                  AND (p.frame_id % 100) = 0
                  {perspective_cond} {window_filter} {track_filter}
                ORDER BY p.frame_id
                LIMIT 12000""",
            params,
        )

    # Deduplicate: each track_id under the team with the most frames
    best: dict[int, dict[str, int | str]] = {}
    for r in cast(list[dict[str, int | str]], available_tracks):
        tid = int(r["track_id"])
        cnt = int(r["frame_count"])
        if tid not in best or cnt > int(best[tid]["frame_count"]):
            best[tid] = r
    deduped = list(best.values())

    return {
        "available_track_ids": [
            {
                "track_id": int(r["track_id"]),
                "team": str(r["team"]),
                "first_frame": int(r["first_frame"]),
                "last_frame": int(r["last_frame"]),
                "frame_count": int(r["frame_count"]),
                "first_time_s": round(int(r["first_frame"]) / fps, 1),
                "last_time_s": round(int(r["last_frame"]) / fps, 1),
            }
            for r in deduped
        ],
        "heatmap_points": _coerce_heatmap_point_rows(points),
    }


@router.get("/matches/{match_id}/scoreboard")
def get_scoreboard(match_id: str):
    """Returns non-null scoreboard readings (game_time, scores) for a match."""
    rows = query_duckdb(
        """
        SELECT frame_number, timestamp_sec, game_time, score_home, score_away
        FROM scoreboard_readings
        WHERE match_id = ? AND game_time IS NOT NULL
        ORDER BY frame_number
        """,
        [match_id],
    )
    return [
        {
            "frame_number": r["frame_number"],
            "timestamp_sec": r["timestamp_sec"],
            "game_time": r["game_time"],
            "score_home": r["score_home"],
            "score_away": r["score_away"],
        }
        for r in rows
    ]


@router.get("/matches/{match_id}/scoreboard/summary", response_model=ScoreboardSummary)
def get_scoreboard_summary(match_id: str):
    """Returns the final score, final game time, and goal timeline for a match."""
    any_rows = query_duckdb(
        "SELECT 1 FROM scoreboard_readings WHERE match_id = ? LIMIT 1",
        [match_id],
    )
    if not any_rows:
        raise HTTPException(status_code=404, detail="No scoreboard readings for this match")

    final_rows = query_duckdb(
        """
        SELECT game_time, score_home, score_away
        FROM scoreboard_readings
        WHERE match_id = ? AND score_home IS NOT NULL AND score_away IS NOT NULL
        ORDER BY frame_number DESC
        LIMIT 1
        """,
        [match_id],
    )
    final = final_rows[0] if final_rows else None

    goal_rows = query_duckdb(
        """
        SELECT frame_number, timestamp_sec, game_time, team, score_home, score_away
        FROM goal_events
        WHERE match_id = ?
        ORDER BY frame_number
        """,
        [match_id],
    )

    return ScoreboardSummary(
        match_id=match_id,
        final_score_home=final["score_home"] if final else None,
        final_score_away=final["score_away"] if final else None,
        final_game_time=final["game_time"] if final else None,
        goals=[
            GoalEvent(
                frame_number=r["frame_number"],
                timestamp_sec=r["timestamp_sec"],
                game_time=r["game_time"],
                team=r["team"],
                score_home=r["score_home"],
                score_away=r["score_away"],
            )
            for r in goal_rows
        ],
    )


@router.get("/matches/{match_id}/goals")
def get_goals(match_id: str):
    """Returns detected goal events for a match in chronological order."""
    rows = query_duckdb(
        """
        SELECT frame_number, timestamp_sec, game_time, team, score_home, score_away
        FROM goal_events
        WHERE match_id = ?
        ORDER BY frame_number
        """,
        [match_id],
    )
    return [
        {
            "frame_number": r["frame_number"],
            "timestamp_sec": r["timestamp_sec"],
            "game_time": r["game_time"],
            "team": r["team"],
            "score_home": r["score_home"],
            "score_away": r["score_away"],
        }
        for r in rows
    ]


@router.get("/matches/{match_id}/video")
def stream_match_video(match_id: str) -> FileResponse:
    """
    Stream the match video with HTTP range-request support for frontend seeking.

    Prefers the annotated output video (with player overlays); falls back to the
    original uploaded video. Used by the formation scene player in the frontend.
    """
    from backend.routes.upload import DATA_OUTPUT_VIDEOS

    annotated = DATA_OUTPUT_VIDEOS / f"{match_id}_annotated.mp4"
    if annotated.exists():
        return FileResponse(path=str(annotated), media_type="video/mp4")

    rows = query_duckdb("SELECT video_path FROM matches WHERE match_id = ?", [match_id])
    if not rows:
        raise HTTPException(status_code=404, detail="Match not found")

    video_path = get_absolute_video_path(str(rows[0]["video_path"]))
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    return FileResponse(path=str(video_path), media_type="video/mp4")


@router.get("/matches/{match_id}/thumbnail")
def get_match_thumbnail(match_id: str):
    """Extracts a specific frame from the video and returns it as a JPEG image."""

    query = "SELECT video_path FROM matches WHERE match_id = ?"
    rows = list(query_duckdb(query, [match_id]))

    if not rows:
        raise HTTPException(status_code=404, detail="Match not found")

    video_path = get_absolute_video_path(rows[0]["video_path"])

    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    image_bytes = extract_frame_as_jpeg(video_path, THUMBNAIL_FRAME_INDEX)

    return Response(content=image_bytes, media_type="image/jpeg")
