"""
Unit tests for tracking_postprocessing.py.

All tests use an in-memory DuckDB connection — no GPU, no video files required.
"""

import duckdb

from ingestion.pipeline.tracking_postprocessing import (
    detect_id_switches,
    filter_ghosts,
    interpolate_tracks,
    merge_id_switches,
)

MATCH = "test_match"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_conn() -> duckdb.DuckDBPyConnection:
    conn = duckdb.connect(":memory:")
    conn.execute("""
        CREATE TABLE frames (
            match_id TEXT, frame_id INTEGER, timestamp_s DOUBLE,
            player_count INTEGER, on_court_count INTEGER,
            PRIMARY KEY (match_id, frame_id)
        )
    """)
    conn.execute("""
        CREATE TABLE players (
            match_id TEXT, frame_id INTEGER, track_id INTEGER,
            team TEXT NOT NULL DEFAULT 'unknown',
            court_x DOUBLE, court_y DOUBLE,
            pixel_foot_x DOUBLE NOT NULL DEFAULT 0,
            pixel_foot_y DOUBLE NOT NULL DEFAULT 0,
            velocity_x DOUBLE NOT NULL DEFAULT 0,
            velocity_y DOUBLE NOT NULL DEFAULT 0,
            confidence DOUBLE NOT NULL DEFAULT 1.0,
            on_court BOOLEAN NOT NULL DEFAULT TRUE,
            has_ball BOOLEAN NOT NULL DEFAULT FALSE,
            bbox_x1 INTEGER NOT NULL DEFAULT 0,
            bbox_y1 INTEGER NOT NULL DEFAULT 0,
            bbox_x2 INTEGER NOT NULL DEFAULT 10,
            bbox_y2 INTEGER NOT NULL DEFAULT 10,
            PRIMARY KEY (match_id, frame_id, track_id)
        )
    """)
    return conn


def insert_frames(conn: duckdb.DuckDBPyConnection, frame_ids: list[int]) -> None:
    for fid in frame_ids:
        conn.execute(
            "INSERT INTO frames VALUES (?, ?, ?, ?, ?)",
            [MATCH, fid, fid / 30.0, 0, 0],
        )


def insert_player(
    conn: duckdb.DuckDBPyConnection,
    frame_id: int,
    track_id: int,
    cx: float = 100.0,
    cy: float = 100.0,
) -> None:
    half_w, half_h = 20, 40
    x1 = round(cx - half_w)
    y1 = round(cy - half_h)
    x2 = round(cx + half_w)
    y2 = round(cy + half_h)
    conn.execute(
        """
        INSERT INTO players
        (match_id, frame_id, track_id, pixel_foot_x, pixel_foot_y,
         bbox_x1, bbox_y1, bbox_x2, bbox_y2)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [MATCH, frame_id, track_id, float(cx), float(cy), x1, y1, x2, y2],
    )


def all_players(conn: duckdb.DuckDBPyConnection) -> list[tuple]:
    return conn.execute(
        "SELECT frame_id, track_id FROM players WHERE match_id = ? ORDER BY frame_id, track_id",
        [MATCH],
    ).fetchall()


# ---------------------------------------------------------------------------
# filter_ghosts
# ---------------------------------------------------------------------------


def test_filter_ghosts_removes_short_track():
    conn = make_conn()
    # Stable track: 15 frames
    for f in range(15):
        insert_player(conn, f, track_id=1, cx=100)
    # Ghost track: 3 frames, far away (no reassignment)
    for f in range(3):
        insert_player(conn, f, track_id=99, cx=500)

    n_reassigned, n_dropped = filter_ghosts(conn, MATCH, ghost_threshold=10, max_reassign_dist=50)

    assert n_reassigned == 0
    assert n_dropped == 3
    track_ids = {r[1] for r in all_players(conn)}
    assert 99 not in track_ids


def test_filter_ghosts_reassigns_to_absent_stable_track():
    conn = make_conn()
    # Stable track 1 at frames 0-14, mean cx=100
    for f in range(15):
        insert_player(conn, f, track_id=1, cx=100)
    # Ghost at frames 20,21 (cx=115) — track 1 is NOT present there.
    # Mean distance from track 1: ~15 px < max_reassign_dist=50 → reassigned.
    for f in [20, 21]:
        insert_player(conn, f, track_id=99, cx=115)

    n_reassigned, n_dropped = filter_ghosts(conn, MATCH, ghost_threshold=10, max_reassign_dist=50)

    assert n_reassigned == 2
    assert n_dropped == 0
    # Both detections should now carry track_id=1
    track_ids = {r[1] for r in all_players(conn)}
    assert 99 not in track_ids
    assert 1 in track_ids


def test_filter_ghosts_drops_when_stable_present_in_same_frame():
    conn = make_conn()
    # Stable track 1 at frames 0-14 including frame 5
    for f in range(15):
        insert_player(conn, f, track_id=1, cx=100)
    # Ghost at frame 5 — track 1 IS present there → PK conflict → dropped
    insert_player(conn, 5, track_id=99, cx=115)

    n_reassigned, n_dropped = filter_ghosts(conn, MATCH, ghost_threshold=10, max_reassign_dist=200)

    assert n_dropped == 1
    assert n_reassigned == 0


def test_filter_ghosts_no_ghosts():
    conn = make_conn()
    for f in range(15):
        insert_player(conn, f, track_id=1)
        insert_player(conn, f, track_id=2, cx=300)

    n_reassigned, n_dropped = filter_ghosts(conn, MATCH, ghost_threshold=10)

    assert n_reassigned == 0
    assert n_dropped == 0


def test_filter_ghosts_empty_table():
    conn = make_conn()
    n_reassigned, n_dropped = filter_ghosts(conn, MATCH)
    assert n_reassigned == 0
    assert n_dropped == 0


def test_filter_ghosts_exactly_at_threshold_is_stable():
    conn = make_conn()
    # Exactly ghost_threshold frames → stable (>= not <)
    for f in range(10):
        insert_player(conn, f, track_id=1)

    n_reassigned, n_dropped = filter_ghosts(conn, MATCH, ghost_threshold=10)

    assert n_reassigned == 0
    assert n_dropped == 0


# ---------------------------------------------------------------------------
# interpolate_tracks
# ---------------------------------------------------------------------------


def test_interpolate_fills_single_gap():
    conn = make_conn()
    insert_frames(conn, [0, 1, 2])
    insert_player(conn, 0, track_id=1, cx=100)
    insert_player(conn, 2, track_id=1, cx=120)  # frame 1 missing

    n = interpolate_tracks(conn, MATCH)

    assert n == 1
    rows = all_players(conn)
    frame_ids = [r[0] for r in rows if r[1] == 1]
    assert 1 in frame_ids


def test_interpolate_bbox_values_are_midpoint():
    conn = make_conn()
    insert_frames(conn, [0, 2])  # only frames 0 and 2 exist (stride=2)
    insert_player(conn, 0, track_id=1, cx=100)
    insert_player(conn, 2, track_id=1, cx=200)

    # No frame 1 in `frames` table → nothing to insert
    n = interpolate_tracks(conn, MATCH)
    assert n == 0


def test_interpolate_respects_stride():
    conn = make_conn()
    # stride=2: frames 0,2,4,6 exist; track missing at 2 and 4
    insert_frames(conn, [0, 2, 4, 6])
    insert_player(conn, 0, track_id=1, cx=100)
    insert_player(conn, 6, track_id=1, cx=160)

    n = interpolate_tracks(conn, MATCH)

    assert n == 2  # frames 2 and 4 inserted
    frame_ids = [r[0] for r in all_players(conn) if r[1] == 1]
    assert sorted(frame_ids) == [0, 2, 4, 6]


def test_interpolate_no_gap():
    conn = make_conn()
    insert_frames(conn, [0, 1, 2])
    for f in range(3):
        insert_player(conn, f, track_id=1)

    n = interpolate_tracks(conn, MATCH)
    assert n == 0


def test_interpolate_multiple_tracks_independent():
    conn = make_conn()
    insert_frames(conn, list(range(5)))
    for f in [0, 4]:
        insert_player(conn, f, track_id=1, cx=100)
    for f in [0, 2, 4]:
        insert_player(conn, f, track_id=2, cx=300)

    n = interpolate_tracks(conn, MATCH)

    # track 1: gaps at 1,2,3 → 3 rows; track 2: gaps at 1,3 → 2 rows
    assert n == 5


def test_interpolate_single_frame_track_unchanged():
    conn = make_conn()
    insert_frames(conn, [5])
    insert_player(conn, 5, track_id=7)

    n = interpolate_tracks(conn, MATCH)
    assert n == 0


def test_interpolate_empty_table():
    conn = make_conn()
    n = interpolate_tracks(conn, MATCH)
    assert n == 0


# ---------------------------------------------------------------------------
# detect_id_switches
# ---------------------------------------------------------------------------


def test_detect_id_switches_finds_switch():
    conn = make_conn()
    # Track 1 ends at frame 10, track 2 starts at frame 12 — 4 px apart
    for f in range(11):
        insert_player(conn, f, track_id=1, cx=100)
    for f in range(12, 25):
        insert_player(conn, f, track_id=2, cx=104)

    switches = detect_id_switches(conn, MATCH, max_gap=5, max_dist=50)

    assert len(switches) == 1
    old_id, new_id = switches[0]
    assert old_id == 1
    assert new_id == 2


def test_detect_id_switches_gap_too_large():
    conn = make_conn()
    for f in range(10):
        insert_player(conn, f, track_id=1, cx=100)
    for f in range(25, 40):
        insert_player(conn, f, track_id=2, cx=102)

    switches = detect_id_switches(conn, MATCH, max_gap=5, max_dist=50)
    assert switches == []


def test_detect_id_switches_dist_too_large():
    conn = make_conn()
    for f in range(10):
        insert_player(conn, f, track_id=1, cx=100)
    for f in range(12, 25):
        insert_player(conn, f, track_id=2, cx=500)

    switches = detect_id_switches(conn, MATCH, max_gap=5, max_dist=50)
    assert switches == []


def test_detect_id_switches_empty():
    conn = make_conn()
    switches = detect_id_switches(conn, MATCH)
    assert switches == []


# ---------------------------------------------------------------------------
# merge_id_switches
# ---------------------------------------------------------------------------


def test_merge_id_switches_renames_track():
    conn = make_conn()
    # Track 1 at frames 0-9, track 2 at frames 11-20 (no overlap)
    for f in range(10):
        insert_player(conn, f, track_id=1)
    for f in range(11, 21):
        insert_player(conn, f, track_id=2)

    n = merge_id_switches(conn, MATCH, [(1, 2)])  # merge 2 into 1

    assert n == 1
    track_ids = {r[1] for r in all_players(conn)}
    assert 1 in track_ids
    assert 2 not in track_ids


def test_merge_id_switches_skips_overlapping_tracks():
    conn = make_conn()
    # Tracks 1 and 2 both present in frame 5 → overlap → skip
    for f in range(10):
        insert_player(conn, f, track_id=1)
        insert_player(conn, f, track_id=2, cx=300)

    n = merge_id_switches(conn, MATCH, [(1, 2)])

    assert n == 0  # skipped due to overlap
    track_ids = {r[1] for r in all_players(conn)}
    assert 1 in track_ids
    assert 2 in track_ids


def test_merge_id_switches_empty_list():
    conn = make_conn()
    for f in range(5):
        insert_player(conn, f, track_id=1)

    n = merge_id_switches(conn, MATCH, [])
    assert n == 0


def test_merge_id_switches_chain_resolution():
    conn = make_conn()
    # Chain: 3 → 2 → 1 (all non-overlapping)
    for f in range(5):
        insert_player(conn, f, track_id=1)
    for f in range(6, 11):
        insert_player(conn, f, track_id=2)
    for f in range(12, 17):
        insert_player(conn, f, track_id=3)

    # Pass switches in order: (1,2) means merge 2 into 1, (2,3) means merge 3 into 2
    # Chain resolution should map both 2 and 3 → 1
    n = merge_id_switches(conn, MATCH, [(1, 2), (2, 3)])

    assert n == 2
    track_ids = {r[1] for r in all_players(conn)}
    assert track_ids == {1}
