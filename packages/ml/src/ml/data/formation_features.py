"""
Feature extraction for contrastive formation learning.

Loads per-frame player positions from DuckDB. When court_x/court_y are
available (calibration was used) we prefer those. Otherwise we fall back to
normalized pixel foot positions.

Preprocessing applied in both cases:
  1. Normalize to [0, 1] range (÷court dimensions or ÷image dimensions)
  2. Subtract team centroid  → translation-invariant, camera-independent
  3. Pad / truncate to MAX_PLAYERS (zeros = padding)

The resulting representation captures formation *geometry* (player positions
relative to the team's center of mass) without depending on absolute
coordinates. This is what the contrastive encoder learns to embed robustly.
"""

from __future__ import annotations

from dataclasses import dataclass

import duckdb
import numpy as np
import pandas as pd

# Court reference dimensions (used when court_x/court_y are available)
COURT_W: float = 40.0
COURT_H: float = 20.0

# Image reference dimensions (used when falling back to pixel coords)
IMAGE_W: float = 1920.0
IMAGE_H: float = 1080.0

# Max players encoded per team per frame (6 field + 1 GK)
MAX_PLAYERS: int = 7


@dataclass
class FormationSample:
    match_id: str
    frame_id: int
    team: str
    positions: np.ndarray  # (MAX_PLAYERS, 2), float32, centroid-subtracted; zeros = padding
    n_valid: int  # number of real (non-padded) players


def load_formation_samples(
    conn: duckdb.DuckDBPyConnection,
    match_id: str | list[str] | None = None,
    min_players: int = 4,
    stride: int = 1,
) -> list[FormationSample]:
    """
    Load per-frame, per-team formation snapshots from DuckDB.

    Args:
        conn:         Read-only or writable DuckDB connection.
        match_id:     Restrict to one match (str), multiple matches (list of str),
                      or None for all matches.
        min_players:  Minimum valid players per snapshot; smaller frames skipped.
        stride:       Only keep every Nth frame (e.g. stride=5 → 5 fps at 25 fps video).

    Returns:
        List of FormationSample objects ready for FormationDataset.
    """
    if isinstance(match_id, list):
        placeholders = ", ".join("?" * len(match_id))
        where_match = f"AND p.match_id IN ({placeholders})"
        params: list[object] = list(match_id)
    elif match_id is not None:
        where_match = "AND p.match_id = ?"
        params = [match_id]
    else:
        where_match = ""
        params = []

    # Prefer court coordinates; fall back to normalized pixel coordinates.
    # We compute both and select at Python level after checking NULL coverage.
    df: pd.DataFrame = conn.execute(
        f"""
        SELECT
            p.match_id,
            p.frame_id,
            p.team,
            p.court_x,
            p.court_y,
            p.pixel_foot_x,
            p.pixel_foot_y,
            p.on_court,
            p.confidence
        FROM players p
        WHERE p.on_court = TRUE
          AND p.team IN ('A', 'B')
          {where_match}
        ORDER BY p.match_id, p.frame_id, p.team, p.track_id
        """,
        params,
    ).df()

    if df.empty:
        # Fallback: no team labels — use all on-court players as one blob
        df = conn.execute(
            f"""
            SELECT
                p.match_id,
                p.frame_id,
                'all' AS team,
                p.court_x,
                p.court_y,
                p.pixel_foot_x,
                p.pixel_foot_y,
                p.on_court,
                p.confidence
            FROM players p
            WHERE p.on_court = TRUE
              {where_match}
            ORDER BY p.match_id, p.frame_id, p.track_id
            """,
            params,
        ).df()

    use_court = df["court_x"].notna().mean() > 0.5

    samples: list[FormationSample] = []
    for (mid, fid, team), group in df.groupby(["match_id", "frame_id", "team"]):
        if int(fid) % stride != 0:
            continue

        if use_court:
            valid = group[["court_x", "court_y"]].dropna()
            if len(valid) < min_players:
                continue
            raw = valid.values.astype(np.float32)
            raw[:, 0] /= COURT_W
            raw[:, 1] /= COURT_H
        else:
            valid_mask = group["pixel_foot_x"].notna()
            valid = group.loc[valid_mask, ["pixel_foot_x", "pixel_foot_y"]]
            if len(valid) < min_players:
                continue
            raw = valid.values.astype(np.float32)
            raw[:, 0] /= IMAGE_W
            raw[:, 1] /= IMAGE_H

        # Subtract centroid → translation-invariant
        centroid = raw.mean(axis=0)
        raw -= centroid

        # Pad / truncate to MAX_PLAYERS
        padded = np.zeros((MAX_PLAYERS, 2), dtype=np.float32)
        n = min(len(raw), MAX_PLAYERS)
        padded[:n] = raw[:n]

        samples.append(
            FormationSample(
                match_id=str(mid),
                frame_id=int(fid),
                team=str(team),
                positions=padded,
                n_valid=n,
            )
        )

    return samples
