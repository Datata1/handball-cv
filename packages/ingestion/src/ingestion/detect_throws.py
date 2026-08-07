r"""Detect Throws — Werkzeug für die Analyse von Würfen in der DuckDB

Dieses Skript liest die Tabellen `players` und `ball` aus einer DuckDB-Datei
und erkennt mögliche Würfe (Abwürfe) in Richtung Torwart. Ergebnis ist ein
Pandas DataFrame mit den Positionen (court_x, court_y) der werfenden Spieler.




Optionale Flags:
    --lookahead N          Anzahl Folge-Frames, die auf einen Wurf geprüft werden (Default 8)
    --min-net-reduction PX Minimale Netto-Reduktion in Pixeln gegenüber dem Torwart (Default 30.0)
    --no-monotonic         Monotone-Abnahme-Anforderung deaktivieren

Hinweise:
 - Benötigt Python-Pakete: duckdb, pandas, numpy
 - Das Skript bevorzugt das persistierte Feld `class_name` in der Tabelle `players`
   (z. B. 'goalkeeper'). Falls dieses nicht vorhanden ist, fällt es auf `is_goalkeeper` zurück.

Beispiel (als Modul):
    from ingestion.tools.detect_throws import detect_throws
    df = detect_throws(Path('scripts/matches.duckdb'), match_id=None)
    print(df)
"""

from __future__ import annotations

import argparse
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd


def load_tables(
    conn: duckdb.DuckDBPyConnection, match_id: str | None = None
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load players and ball tables (optionally filtered by match_id) as pandas DataFrames.
    The result frames are sorted by (match_id, frame_id) to ensure chronological order.
    """
    # Discover which columns the `players` table actually exposes so we don't
    # SELECT non-existent columns (some DBs may not have `is_goalkeeper`). We
    # prefer to SELECT only the columns that exist and are required by the
    # detection logic.
    try:
        conn.execute("SELECT * FROM players LIMIT 0")
        players_cols = [c[0] for c in conn.description]
    except Exception:
        # players table missing or unreadable — return empty frames
        empty_players = pd.DataFrame(
            {},
            columns=pd.Index(
                [
                    "match_id",
                    "frame_id",
                    "track_id",
                    "court_x",
                    "court_y",
                    "bbox_x1",
                    "bbox_y1",
                    "bbox_x2",
                    "bbox_y2",
                    "has_ball",
                ]
            ),
        )
        empty_ball = pd.DataFrame(
            {},
            columns=pd.Index(["match_id", "frame_id", "pixel_x", "pixel_y"]),
        )
        return empty_players, empty_ball

    # Base set of columns we need
    base_cols = [
        "match_id",
        "frame_id",
        "track_id",
        "court_x",
        "court_y",
        "bbox_x1",
        "bbox_y1",
        "bbox_x2",
        "bbox_y2",
        "has_ball",
    ]

    # Optional columns that may or may not exist in older DBs
    optional_cols = [c for c in ("class_name", "is_goalkeeper") if c in players_cols]

    select_cols = base_cols + optional_cols

    players_select = f"SELECT {', '.join(select_cols)} FROM players"
    ball_select = "SELECT match_id, frame_id, pixel_x, pixel_y FROM ball"

    if match_id is None:
        players_q = players_select + " ORDER BY match_id, frame_id"
        ball_q = ball_select + " ORDER BY match_id, frame_id"
        players = conn.execute(players_q).fetchdf()
        try:
            ball = conn.execute(ball_q).fetchdf()
        except Exception:
            ball = pd.DataFrame(
                {},
                columns=pd.Index(["match_id", "frame_id", "pixel_x", "pixel_y"]),
            )
    else:
        players_q = players_select + " WHERE match_id = ? ORDER BY frame_id"
        ball_q = ball_select + " WHERE match_id = ? ORDER BY frame_id"
        players = conn.execute(players_q, [match_id]).fetchdf()
        try:
            ball = conn.execute(ball_q, [match_id]).fetchdf()
        except Exception:
            ball = pd.DataFrame(
                {},
                columns=pd.Index(["match_id", "frame_id", "pixel_x", "pixel_y"]),
            )

    return players, ball


def goalkeeper_centers(players_df: pd.DataFrame) -> pd.DataFrame:
    """Return a DataFrame of goalkeeper centers per frame: columns match_id, frame_id, g_x, g_y.
    If multiple goalkeepers exist in a frame, take the one with highest bbox area (heuristic) or first.
    """
    # Prefer explicit YOLO label 'goalkeeper' if present, otherwise use boolean is_goalkeeper
    if "class_name" in players_df.columns:
        g = players_df[players_df["class_name"] == "goalkeeper"].copy()
        if g.empty and "is_goalkeeper" in players_df.columns:
            g = players_df[players_df["is_goalkeeper"]].copy()
    else:
        g = players_df[players_df["is_goalkeeper"]].copy()
    if g.empty:
        return pd.DataFrame(
            {},
            columns=pd.Index(["match_id", "frame_id", "g_x", "g_y"]),
        )

    # compute bbox center
    g["g_x"] = (g["bbox_x1"] + g["bbox_x2"]) / 2.0
    g["g_y"] = (g["bbox_y1"] + g["bbox_y2"]) / 2.0
    # choose goalkeeper per frame: prefer larger bbox area
    g["area"] = (g["bbox_x2"] - g["bbox_x1"]) * (g["bbox_y2"] - g["bbox_y1"])
    g_sorted = g.sort_values(["match_id", "frame_id", "area"], ascending=[True, True, False])
    g_unique = g_sorted.drop_duplicates(["match_id", "frame_id"], keep="first")
    return g_unique[["match_id", "frame_id", "g_x", "g_y"]]


def detect_throws_for_match(
    players: pd.DataFrame,
    ball: pd.DataFrame,
    match_id: str,
    lookahead_frames: int = 8,
    min_net_reduction_px: float = 30.0,
    require_monotonic: bool = True,
) -> list[dict[str, str | int | float]]:
    """Detect throws for a single match and return list of records with match_id, frame_id, thrower_track_id, court_x, court_y.

    Parameters:
    - lookahead_frames: how many future frames to inspect after a has_ball event
    - min_net_reduction_px: minimal total reduction in pixel distance to consider a throw
    - require_monotonic: if True, require the distance to generally decrease in consecutive frames
    """
    # restrict to match
    p = players[players["match_id"] == match_id]
    b = ball[ball["match_id"] == match_id]

    if p.empty or b.empty:
        return []

    # precompute goalkeeper centers
    gcenters = goalkeeper_centers(p)
    gcenters = gcenters.set_index("frame_id")

    # index ball by frame for quick lookup
    b_by_frame = b.set_index("frame_id")

    # group players by frame for quick access
    players_by_frame = {fid: df for fid, df in p.groupby("frame_id")}

    frames = sorted(set(p["frame_id"]).union(b["frame_id"]))

    results: list[dict[str, str | int | float]] = []

    for fid in frames:
        frame_players = players_by_frame.get(fid)
        if frame_players is None:
            continue

        # find players with has_ball
        ballers = frame_players[frame_players["has_ball"]]
        if ballers.empty:
            continue

        # get ball pos at this frame
        try:
            ball_pos = b_by_frame.loc[fid][["pixel_x", "pixel_y"]].to_numpy(dtype=float)
        except KeyError:
            # no ball detected this frame — skip
            continue

        for _, thrower in ballers.iterrows():
            # ensure thrower has court coords
            if pd.isna(thrower.get("court_x")) or pd.isna(thrower.get("court_y")):
                continue

            # lookahead frames
            future_fids = [f for f in range(fid + 1, fid + 1 + lookahead_frames)]
            dists: list[float] = []
            valid_future = False
            for ff in future_fids:
                # need ball and goalkeeper position for this future frame
                if ff not in b_by_frame.index or ff not in gcenters.index:
                    # still append large distance to keep sequence length consistent
                    dists.append(float("inf"))
                    continue

                future_ball = b_by_frame.loc[ff][["pixel_x", "pixel_y"]].to_numpy(dtype=float)
                g = gcenters.loc[ff]
                gpos = np.array([g["g_x"], g["g_y"]], dtype=float)
                dist = float(np.linalg.norm(future_ball - gpos))
                dists.append(dist)
                valid_future = True

            if not valid_future:
                continue

            # initial distance
            init_dist = (
                float(
                    np.linalg.norm(
                        ball_pos - gcenters.loc[fid][["g_x", "g_y"]].to_numpy(dtype=float)
                    )
                )
                if fid in gcenters.index
                else None
            )
            if init_dist is None:
                # if goalkeeper not present at initial frame, skip
                continue

            # check monotonic decrease
            net_reduction = init_dist - np.nanmin([d for d in dists if np.isfinite(d)])
            if net_reduction < min_net_reduction_px:
                continue

            if require_monotonic:
                # consider only the finite distances
                finite_d = [d for d in dists if np.isfinite(d)]
                if len(finite_d) < 2:
                    continue
                # check majority of steps decrease
                decreases = sum(1 for i in range(1, len(finite_d)) if finite_d[i] < finite_d[i - 1])
                if decreases < max(1, int(0.6 * (len(finite_d) - 1))):
                    continue

            # passed heuristics — mark throw at current frame
            results.append(
                {
                    "match_id": match_id,
                    "frame_id": int(fid),
                    "thrower_track_id": int(thrower["track_id"]),
                    "court_x": float(thrower["court_x"]),
                    "court_y": float(thrower["court_y"]),
                }
            )

    return results


def detect_throws(db_path: Path, match_id: str | None = None, **kwargs) -> pd.DataFrame:
    conn = duckdb.connect(str(db_path))
    players, ball = load_tables(conn, match_id)
    if players.empty or ball.empty:
        return pd.DataFrame(
            {},
            columns=pd.Index(["match_id", "frame_id", "thrower_track_id", "court_x", "court_y"]),
        )

    match_ids = [match_id] if match_id is not None else sorted(players["match_id"].unique())
    records: list[dict[str, str | int | float]] = []
    for mid in match_ids:
        recs = detect_throws_for_match(players, ball, mid, **kwargs)
        records.extend(recs)

    df = pd.DataFrame.from_records(
        records,
        columns=pd.Index(["match_id", "frame_id", "thrower_track_id", "court_x", "court_y"]),
    )
    return df


def cli() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--db",
        type=Path,
        default=Path(__file__).resolve().parents[4]
        / "data"
        / "output"
        / "duckdb"
        / "matches.duckdb",
        help="Path to DuckDB file",
    )
    parser.add_argument("--match", type=str, default=None, help="Optional match_id to restrict to")
    parser.add_argument("--lookahead", type=int, default=8, help="Frames to look ahead for a throw")
    parser.add_argument(
        "--min-net-reduction",
        type=float,
        default=30.0,
        help="Minimum net reduction in pixel distance to goalkeeper",
    )
    parser.add_argument(
        "--no-monotonic",
        dest="monotonic",
        action="store_false",
        help="Don't require monotonic decrease in distance",
    )
    args = parser.parse_args()

    df = detect_throws(
        args.db,
        match_id=args.match,
        lookahead_frames=args.lookahead,
        min_net_reduction_px=args.min_net_reduction,
        require_monotonic=args.monotonic,
    )
    print(df)


if __name__ == "__main__":
    cli()
