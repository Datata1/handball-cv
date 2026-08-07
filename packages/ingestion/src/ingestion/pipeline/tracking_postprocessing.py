"""
Tracking post-processing: ghost cleanup, interpolation, and ID-switch merging.

These functions run after Phase 2 (frame-by-frame pipeline) and before Phase 4
(velocity + ball-carrier computation).  They read the players table, process it
with pandas, and write corrections back via SQL.

Phase order matters:
  3a. filter_ghosts        — remove/reassign spurious short-lived tracks first
  3b. merge_id_switches    — unify tracks that are the same player under two IDs
  3c. interpolate_tracks   — fill gaps AFTER merges so no new gaps are left open
  4.  _compute_velocities  — needs complete, gap-free position data
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def filter_ghosts(
    conn: object,
    match_id: str,
    *,
    ghost_threshold: int = 10,
    max_reassign_dist: float = 150.0,
) -> tuple[int, int]:
    """
    Remove ghost tracks (seen in fewer than *ghost_threshold* frames).

    Before dropping a ghost detection, try to reassign it to the nearest
    stable track visible in the same frame if within *max_reassign_dist* pixels.
    Reassigned rows keep their detection data but adopt the stable track's ID.

    Returns:
        (n_reassigned, n_dropped)
    """
    import duckdb as _duckdb

    assert isinstance(conn, _duckdb.DuckDBPyConnection)

    df: pd.DataFrame = conn.execute(
        """
        SELECT frame_id, track_id, confidence, team, on_court,
               court_x, court_y, pixel_foot_x, pixel_foot_y,
               velocity_x, velocity_y, has_ball,
               bbox_x1, bbox_y1, bbox_x2, bbox_y2
        FROM players
        WHERE match_id = ?
        """,
        [match_id],
    ).df()

    if df.empty:
        return 0, 0

    df["cx"] = (df["bbox_x1"] + df["bbox_x2"]) / 2.0
    df["cy"] = (df["bbox_y1"] + df["bbox_y2"]) / 2.0

    frame_counts = df.groupby("track_id")["frame_id"].nunique()
    ghost_ids = set(frame_counts[frame_counts < ghost_threshold].index)
    stable_ids = set(frame_counts[frame_counts >= ghost_threshold].index)

    logger.info(
        "  ghost tracks (< %d frames): %d  |  stable: %d",
        ghost_threshold,
        len(ghost_ids),
        len(stable_ids),
    )

    if not ghost_ids:
        logger.info("  no ghost tracks to remove")
        return 0, 0

    stable_df = df[df["track_id"].isin(stable_ids)].copy()
    ghost_df = df[df["track_id"].isin(ghost_ids)].copy()

    # Mean position per stable track — used as reference when the stable track
    # isn't visible in the ghost's frame (the only case where reassignment is safe).
    stable_mean_pos: pd.DataFrame = stable_df.groupby("track_id")[["cx", "cy"]].mean()

    # Stable track IDs present at each frame (reassigning there would cause a PK conflict).
    stable_ids_by_frame: dict[int, set[int]] = {
        int(frame): set(grp["track_id"].astype(int)) for frame, grp in stable_df.groupby("frame_id")
    }

    # Only tracks newly-reassigned assignments; does NOT pre-fill with existing stable slots
    # so that slots absent from the DB can still receive a ghost's detection.
    already_taken: set[tuple[int, int]] = set()

    reassign_map: list[tuple[int, int, int]] = []  # (frame_id, ghost_id, stable_id)
    drop_keys: list[tuple[int, int]] = []  # (frame_id, ghost_id) to DELETE

    for _, ghost_row in ghost_df.iterrows():
        frame = int(ghost_row["frame_id"])
        ghost_id = int(ghost_row["track_id"])

        # Candidate stable tracks must NOT already have a detection at this frame —
        # reassigning there would create a primary-key conflict.
        occupied = stable_ids_by_frame.get(frame, set())
        available = stable_mean_pos[~stable_mean_pos.index.isin(occupied)]

        if available.empty:
            drop_keys.append((frame, ghost_id))
            continue

        dists = np.sqrt(
            (available["cx"] - ghost_row["cx"]) ** 2 + (available["cy"] - ghost_row["cy"]) ** 2
        )
        min_idx = dists.idxmin()
        min_dist = float(dists[min_idx])

        if min_dist <= max_reassign_dist:
            nearest_id = int(min_idx)
            key = (frame, nearest_id)
            if key not in already_taken:
                reassign_map.append((frame, ghost_id, nearest_id))
                already_taken.add(key)
                continue

        drop_keys.append((frame, ghost_id))

    for frame_id, old_id, new_id in reassign_map:
        conn.execute(
            "UPDATE players SET track_id = ? WHERE match_id = ? AND frame_id = ? AND track_id = ?",
            [new_id, match_id, frame_id, old_id],
        )

    for frame_id, track_id in drop_keys:
        conn.execute(
            "DELETE FROM players WHERE match_id = ? AND frame_id = ? AND track_id = ?",
            [match_id, frame_id, track_id],
        )

    logger.info(
        "  ghost cleanup: %d reassigned, %d dropped",
        len(reassign_map),
        len(drop_keys),
    )
    return len(reassign_map), len(drop_keys)


def interpolate_tracks(conn: object, match_id: str) -> int:
    """
    Linearly interpolate missing frames within each track's lifespan.

    Only fills frame_ids that already exist in the *frames* table, so the
    function is safe when the pipeline ran with *frame_stride* > 1.

    Returns number of player rows inserted.
    """
    import duckdb as _duckdb

    assert isinstance(conn, _duckdb.DuckDBPyConnection)

    # Sorted array of frame_ids that actually exist — interpolation only fills
    # these, so the result stays correct when the pipeline ran with stride > 1.
    valid_frames: np.ndarray = (  # type: ignore[type-arg]
        conn.execute(
            "SELECT frame_id FROM frames WHERE match_id = ? ORDER BY frame_id",
            [match_id],
        )
        .df()["frame_id"]
        .to_numpy()
    )
    if valid_frames.size == 0:
        return 0

    df: pd.DataFrame = conn.execute(
        """
        SELECT frame_id, track_id, team, court_x, court_y,
               pixel_foot_x, pixel_foot_y, confidence, on_court,
               bbox_x1, bbox_y1, bbox_x2, bbox_y2
        FROM players
        WHERE match_id = ?
        ORDER BY track_id, frame_id
        """,
        [match_id],
    ).df()

    if df.empty:
        return 0

    num_cols = [
        "pixel_foot_x",
        "pixel_foot_y",
        "bbox_x1",
        "bbox_y1",
        "bbox_x2",
        "bbox_y2",
        "confidence",
    ]

    filled: list[pd.DataFrame] = []
    for track_id, group in df.groupby("track_id"):
        first_f = int(group["frame_id"].min())
        last_f = int(group["frame_id"].max())

        # Slice the sorted valid frames to this track's lifespan in O(log F)
        # instead of scanning all frame_ids for every track.
        lo = int(np.searchsorted(valid_frames, first_f, side="left"))
        hi = int(np.searchsorted(valid_frames, last_f, side="right"))
        target_frames = valid_frames[lo:hi]

        present = group["frame_id"].to_numpy()
        missing_mask = ~np.isin(target_frames, present)
        if not missing_mask.any():
            continue

        g = group.set_index("frame_id").reindex(target_frames)
        g["team"] = g["team"].ffill()
        g["on_court"] = g["on_court"].ffill().astype(bool)
        g[num_cols] = g[num_cols].interpolate(method="linear")
        if g["court_x"].notna().any():
            g[["court_x", "court_y"]] = g[["court_x", "court_y"]].interpolate(method="linear")

        # Keep only the frames that were actually missing.
        g = g.loc[target_frames[missing_mask]]
        g["track_id"] = int(track_id)
        filled.append(g.reset_index())

    if not filled:
        logger.info("  interpolation: 0 rows inserted")
        return 0

    out = pd.concat(filled, ignore_index=True)
    out["match_id"] = match_id
    out["velocity_x"] = 0.0  # recomputed in Phase 4
    out["velocity_y"] = 0.0  # recomputed in Phase 4
    out["has_ball"] = False  # recomputed in Phase 4
    out[["bbox_x1", "bbox_y1", "bbox_x2", "bbox_y2"]] = (
        out[["bbox_x1", "bbox_y1", "bbox_x2", "bbox_y2"]].round().astype("int64")
    )
    out["frame_id"] = out["frame_id"].astype("int64")
    out["team"] = out["team"].astype(str)

    insert_df = out[
        [
            "match_id",
            "frame_id",
            "track_id",
            "team",
            "court_x",
            "court_y",
            "pixel_foot_x",
            "pixel_foot_y",
            "velocity_x",
            "velocity_y",
            "confidence",
            "on_court",
            "has_ball",
            "bbox_x1",
            "bbox_y1",
            "bbox_x2",
            "bbox_y2",
        ]
    ]

    # Single columnar append — orders of magnitude faster than row-by-row
    # executemany on DuckDB. NaN in court_x/court_y is stored as NULL.
    conn.register("_interp_rows", insert_df)
    try:
        conn.execute(
            """
            INSERT INTO players
            (match_id, frame_id, track_id, team, court_x, court_y,
             pixel_foot_x, pixel_foot_y, velocity_x, velocity_y,
             confidence, on_court, has_ball,
             bbox_x1, bbox_y1, bbox_x2, bbox_y2)
            SELECT match_id, frame_id, track_id, team, court_x, court_y,
                   pixel_foot_x, pixel_foot_y, velocity_x, velocity_y,
                   confidence, on_court, has_ball,
                   bbox_x1, bbox_y1, bbox_x2, bbox_y2
            FROM _interp_rows
            """
        )
    finally:
        conn.unregister("_interp_rows")

    logger.info("  interpolation: %d rows inserted", len(insert_df))
    return len(insert_df)


def detect_id_switches(
    conn: object,
    match_id: str,
    *,
    max_gap: int = 8,
    max_dist: float = 100.0,
) -> list[tuple[int, int]]:
    """
    Find (old_id, new_id) pairs that likely represent the same player under two IDs.

    An ID switch is inferred when track *new_id* starts within *max_gap* frames
    after *old_id* ends and the spatial distance between their boundary positions
    is within *max_dist* pixels.  Only the closest candidate per *new_id* is kept.

    Returns list of (old_id, new_id) pairs, empty if none found.
    """
    import duckdb as _duckdb

    assert isinstance(conn, _duckdb.DuckDBPyConnection)

    df: pd.DataFrame = conn.execute(
        """
        SELECT frame_id, track_id,
               (bbox_x1 + bbox_x2) / 2.0 AS cx,
               (bbox_y1 + bbox_y2) / 2.0 AS cy
        FROM players
        WHERE match_id = ?
        ORDER BY track_id, frame_id
        """,
        [match_id],
    ).df()

    if df.empty:
        return []

    total_frames = int(df["frame_id"].max())

    track_ends = (
        df.sort_values("frame_id")
        .groupby("track_id")
        .last()[["frame_id", "cx", "cy"]]
        .rename(columns={"frame_id": "last_frame", "cx": "last_cx", "cy": "last_cy"})
    )
    track_starts = (
        df.sort_values("frame_id")
        .groupby("track_id")
        .first()[["frame_id", "cx", "cy"]]
        .rename(columns={"frame_id": "first_frame", "cx": "first_cx", "cy": "first_cy"})
    )

    candidates: list[dict[str, Any]] = []
    for old_id, end_row in track_ends.iterrows():
        if end_row["last_frame"] >= total_frames - max_gap:
            continue
        for new_id, start_row in track_starts.iterrows():
            if old_id == new_id:
                continue
            gap = start_row["first_frame"] - end_row["last_frame"]
            if gap <= 0 or gap > max_gap:
                continue
            dist = float(
                np.sqrt(
                    (start_row["first_cx"] - end_row["last_cx"]) ** 2
                    + (start_row["first_cy"] - end_row["last_cy"]) ** 2
                )
            )
            if dist <= max_dist:
                candidates.append({"old_id": old_id, "new_id": new_id, "dist_px": dist})

    if not candidates:
        return []

    switches_df = (
        pd.DataFrame(candidates)
        .sort_values("dist_px")
        .drop_duplicates(subset="new_id", keep="first")
        .reset_index(drop=True)
    )

    result = [(int(r["old_id"]), int(r["new_id"])) for _, r in switches_df.iterrows()]
    for old_id, new_id in result:
        logger.info("  ID switch candidate: track %d → track %d", new_id, old_id)

    return result


def merge_id_switches(
    conn: object,
    match_id: str,
    switches: list[tuple[int, int]],
) -> int:
    """
    Apply ID switch corrections: rename *new_id* to *old_id* in the players table.

    Chains are resolved automatically (A→B→C becomes A→C).
    Pairs where the two tracks share any frame are skipped to avoid PK conflicts.

    Returns number of track IDs successfully merged.
    """
    import duckdb as _duckdb

    assert isinstance(conn, _duckdb.DuckDBPyConnection)

    if not switches:
        return 0

    # Resolve chains: if id_map[B] = A and id_map[C] = B, resolve C → A
    id_map: dict[int, int] = {}
    for old_id, new_id in switches:
        target = old_id
        while target in id_map:
            target = id_map[target]
        id_map[new_id] = target

    merged = 0
    for new_id, old_id in id_map.items():
        # Skip if the two tracks overlap in any frame (would create a PK conflict)
        overlap: int = conn.execute(
            """
            SELECT COUNT(*) FROM players p1
            JOIN players p2
              ON p1.match_id = p2.match_id AND p1.frame_id = p2.frame_id
            WHERE p1.match_id = ? AND p1.track_id = ? AND p2.track_id = ?
            """,
            [match_id, new_id, old_id],
        ).fetchone()[0]  # type: ignore[index]

        if overlap > 0:
            logger.warning(
                "  skipping merge %d→%d: %d overlapping frames (tracks not the same player)",
                new_id,
                old_id,
                overlap,
            )
            continue

        conn.execute(
            "UPDATE players SET track_id = ? WHERE match_id = ? AND track_id = ?",
            [old_id, match_id, new_id],
        )
        logger.info("  merged track %d into track %d", new_id, old_id)
        merged += 1

    return merged
