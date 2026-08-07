"""Unit tests for the storage layer — uses an in-memory DuckDB connection."""

import duckdb
import pytest

from ingestion.storage.schema import _SCHEMA_SQL
from ingestion.storage.writer import FrameWriter
from ingestion.types import BallState, BoundingBox, FrameState, PlayerState


@pytest.fixture
def conn() -> duckdb.DuckDBPyConnection:
    c = duckdb.connect(":memory:")
    c.execute(_SCHEMA_SQL)
    return c


def _make_frame(frame_id: int = 0) -> FrameState:
    bbox = BoundingBox(x1=100, y1=50, x2=200, y2=250)
    return FrameState(
        frame_id=frame_id,
        timestamp_s=frame_id / 25.0,
        players=[
            PlayerState(
                track_id=1,
                bbox=bbox,
                confidence=0.9,
                team="A",
                court_pos=(10.0, 5.0),
            ),
        ],
        ball=BallState(
            bbox=BoundingBox(300, 100, 320, 120),
            confidence=0.85,
            court_pos=(20.0, 10.0),
        ),
    )


def test_write_single_frame(conn: duckdb.DuckDBPyConnection) -> None:
    writer = FrameWriter(conn, "test_match")
    writer.write(_make_frame(0))
    writer.flush()

    rows = conn.execute("SELECT * FROM frames WHERE match_id = 'test_match'").fetchall()
    assert len(rows) == 1
    assert rows[0][1] == 0  # frame_id


def test_write_ball(conn: duckdb.DuckDBPyConnection) -> None:
    writer = FrameWriter(conn, "test_match")
    writer.write(_make_frame(0))
    writer.flush()

    rows = conn.execute(
        "SELECT court_x, court_y FROM ball WHERE match_id = 'test_match'"
    ).fetchall()
    assert len(rows) == 1
    assert rows[0] == (20.0, 10.0)


def test_write_no_ball(conn: duckdb.DuckDBPyConnection) -> None:
    frame = _make_frame(0)
    frame.ball = None
    writer = FrameWriter(conn, "test_match")
    writer.write(frame)
    writer.flush()

    rows = conn.execute("SELECT * FROM ball WHERE match_id = 'test_match'").fetchall()
    assert rows == []


def test_context_manager_flushes(conn: duckdb.DuckDBPyConnection) -> None:
    with FrameWriter(conn, "test_match") as writer:
        for i in range(3):
            writer.write(_make_frame(i))

    count = conn.execute("SELECT COUNT(*) FROM frames WHERE match_id = 'test_match'").fetchone()
    assert count is not None
    assert count[0] == 3
