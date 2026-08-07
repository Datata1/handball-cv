"""
Writes FrameState objects into the DuckDB tables.

The writer holds an open connection and batches inserts — call flush() to
commit in-flight rows, or use it as a context manager.
"""

from __future__ import annotations

import duckdb

from ingestion.types import FrameState

_BATCH_SIZE = 500  # frames per commit


class FrameWriter:
    """
    Writes FrameState rows into DuckDB.

    Usage:
        with FrameWriter(conn, match_id) as writer:
            for frame_state in pipeline:
                writer.write(frame_state)
    """

    def __init__(self, conn: duckdb.DuckDBPyConnection, match_id: str) -> None:
        self._conn = conn
        self._match_id = match_id
        self._pending = 0

    def write(self, state: FrameState) -> None:
        mid = self._match_id
        fid = state.frame_id

        self._conn.execute(
            "INSERT INTO frames VALUES (?, ?, ?, ?, ?)",
            [mid, fid, state.timestamp_s, state.player_count, state.on_court_count],
        )

        for p in state.players:
            court_x, court_y = (p.court_pos[0], p.court_pos[1]) if p.court_pos else (None, None)
            foot_x, foot_y = p.foot_px
            self._conn.execute(
                "INSERT INTO players VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                [
                    mid,
                    fid,
                    p.track_id,
                    p.team,
                    court_x,
                    court_y,
                    foot_x,
                    foot_y,
                    0.0,  # velocity_x — computed in post-processing
                    0.0,  # velocity_y
                    p.confidence,
                    p.on_court,
                    False,  # has_ball — computed in post-processing
                    p.bbox.x1,
                    p.bbox.y1,
                    p.bbox.x2,
                    p.bbox.y2,
                ],
            )

        if state.ball is not None:
            b = state.ball
            court_x, court_y = (b.court_pos[0], b.court_pos[1]) if b.court_pos else (None, None)
            px, py = b.center_px
            self._conn.execute(
                "INSERT INTO ball VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                [
                    mid,
                    fid,
                    court_x,
                    court_y,
                    px,
                    py,
                    b.confidence,
                    b.bbox.x1,
                    b.bbox.y1,
                    b.bbox.x2,
                    b.bbox.y2,
                ],
            )

        self._pending += 1
        if self._pending >= _BATCH_SIZE:
            self.flush()

    def flush(self) -> None:
        self._conn.commit()
        self._pending = 0

    def __enter__(self) -> FrameWriter:
        return self

    def __exit__(self, *_: object) -> None:
        self.flush()
