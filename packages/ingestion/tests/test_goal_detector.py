"""Unit tests for goal detection — uses in-memory DuckDB, no video required."""

from __future__ import annotations

import duckdb

from ingestion.goal_detector import detect_goals, save_goals


def _setup_db(readings: list[tuple]) -> duckdb.DuckDBPyConnection:
    """Return an in-memory DB with scoreboard_readings populated from *readings*.

    Each tuple: (match_id, frame_number, timestamp_sec, game_time, score_home, score_away)
    """
    con = duckdb.connect(":memory:")
    con.execute(
        """
        CREATE TABLE scoreboard_readings (
            match_id      VARCHAR NOT NULL,
            frame_number  INTEGER NOT NULL,
            timestamp_sec DOUBLE  NOT NULL,
            game_time     VARCHAR,
            score_home    INTEGER,
            score_away    INTEGER,
            PRIMARY KEY (match_id, frame_number)
        )
        """
    )
    for row in readings:
        con.execute("INSERT INTO scoreboard_readings VALUES (?, ?, ?, ?, ?, ?)", list(row))
    return con


def test_home_goal() -> None:
    con = _setup_db(
        [
            ("m1", 0, 0.0, "10:00", 5, 3),
            ("m1", 30, 1.0, "10:01", 6, 3),
        ]
    )
    goals = detect_goals(con, "m1")
    assert len(goals) == 1
    assert goals[0].team == "home"
    assert goals[0].score_home == 6
    assert goals[0].score_away == 3
    assert goals[0].frame_number == 30


def test_away_goal() -> None:
    con = _setup_db(
        [
            ("m1", 0, 0.0, "10:00", 5, 3),
            ("m1", 30, 1.0, "10:01", 5, 4),
        ]
    )
    goals = detect_goals(con, "m1")
    assert len(goals) == 1
    assert goals[0].team == "away"
    assert goals[0].score_home == 5
    assert goals[0].score_away == 4


def test_two_goals_different_teams() -> None:
    con = _setup_db(
        [
            ("m1", 0, 0.0, "10:00", 5, 3),
            ("m1", 30, 1.0, "10:01", 6, 3),
            ("m1", 60, 2.0, "10:02", 6, 4),
        ]
    )
    goals = detect_goals(con, "m1")
    assert len(goals) == 2
    assert goals[0].team == "home"
    assert goals[1].team == "away"


def test_ocr_outlier_ignored_then_correct_goal() -> None:
    con = _setup_db(
        [
            ("m1", 0, 0.0, "10:00", 5, 3),
            ("m1", 30, 1.0, "10:01", 11, 3),  # +6 jump — OCR error, prev stays (5, 3)
            ("m1", 60, 2.0, "10:02", 6, 3),  # +1 relative to prev (5, 3) — valid goal
        ]
    )
    goals = detect_goals(con, "m1")
    assert len(goals) == 1
    assert goals[0].team == "home"
    assert goals[0].frame_number == 60


def test_no_goals_stable_score() -> None:
    con = _setup_db(
        [
            ("m1", 0, 0.0, "10:00", 5, 3),
            ("m1", 30, 1.0, "10:01", 5, 3),
            ("m1", 60, 2.0, "10:02", 5, 3),
        ]
    )
    assert detect_goals(con, "m1") == []


def test_single_reading_no_goals() -> None:
    con = _setup_db(
        [
            ("m1", 0, 0.0, "10:00", 5, 3),
        ]
    )
    assert detect_goals(con, "m1") == []


def test_match_id_without_entries() -> None:
    con = _setup_db(
        [
            ("m1", 0, 0.0, "10:00", 5, 3),
        ]
    )
    assert detect_goals(con, "no_such_match") == []


def test_save_goals_creates_table_and_persists() -> None:
    con = _setup_db(
        [
            ("m1", 0, 0.0, "10:00", 5, 3),
            ("m1", 30, 1.0, "10:01", 6, 3),
        ]
    )
    goals = detect_goals(con, "m1")
    save_goals(con, goals)
    rows = con.execute(
        "SELECT team, score_home, score_away FROM goal_events WHERE match_id = 'm1'"
    ).fetchall()
    assert len(rows) == 1
    assert rows[0] == ("home", 6, 3)


def test_null_scores_skipped() -> None:
    """Frames where score columns are NULL are excluded from goal detection."""
    con = _setup_db(
        [
            ("m1", 0, 0.0, "10:00", 5, 3),
            ("m1", 15, 0.5, None, None, None),  # OCR miss — excluded by WHERE clause
            ("m1", 30, 1.0, "10:01", 6, 3),  # valid +1
        ]
    )
    goals = detect_goals(con, "m1")
    assert len(goals) == 1
    assert goals[0].team == "home"
    assert goals[0].frame_number == 30


def test_both_scores_increase_ignored() -> None:
    """Both sides going up by 1 in the same frame is an OCR artifact — not a goal."""
    con = _setup_db(
        [
            ("m1", 0, 0.0, "10:00", 5, 3),
            ("m1", 30, 1.0, "10:01", 6, 4),  # both +1 simultaneously
        ]
    )
    assert detect_goals(con, "m1") == []


def test_score_decrease_ignored_reference_kept() -> None:
    """A score going down is an OCR error; the previous valid score stays as reference."""
    con = _setup_db(
        [
            ("m1", 0, 0.0, "10:00", 5, 3),
            ("m1", 30, 1.0, "10:01", 4, 3),  # -1 home → OCR error, ref stays (5, 3)
            ("m1", 60, 2.0, "10:02", 6, 3),  # +1 relative to ref (5, 3) → valid goal
        ]
    )
    goals = detect_goals(con, "m1")
    assert len(goals) == 1
    assert goals[0].team == "home"
    assert goals[0].frame_number == 60


def test_game_time_carried_forward_on_goal_frame() -> None:
    """When the goal frame has no OCR game_time, the last known time is used."""
    con = _setup_db(
        [
            ("m1", 0, 0.0, "20:00", 5, 3),
            ("m1", 30, 1.0, None, 6, 3),  # score increased but clock not read
        ]
    )
    goals = detect_goals(con, "m1")
    assert len(goals) == 1
    assert goals[0].game_time == "20:00"


def test_save_goals_empty_list_creates_table() -> None:
    """save_goals with no goals still creates the goal_events table."""
    con = _setup_db([])
    save_goals(con, [])
    count = con.execute("SELECT COUNT(*) FROM goal_events").fetchone()[0]  # type: ignore[index]
    assert count == 0


def test_save_goals_idempotent() -> None:
    """Calling save_goals twice does not duplicate rows."""
    con = _setup_db(
        [
            ("m1", 0, 0.0, "10:00", 5, 3),
            ("m1", 30, 1.0, "10:01", 6, 3),
        ]
    )
    goals = detect_goals(con, "m1")
    save_goals(con, goals)
    save_goals(con, goals)  # second call — INSERT OR REPLACE keeps one row
    count = con.execute("SELECT COUNT(*) FROM goal_events").fetchone()[0]  # type: ignore[index]
    assert count == 1


def test_multiple_matches_isolated() -> None:
    """Goals from one match do not affect detection for another match."""
    con = _setup_db(
        [
            ("m1", 0, 0.0, "10:00", 5, 3),
            ("m1", 30, 1.0, "10:01", 6, 3),
            ("m2", 0, 0.0, "05:00", 10, 8),
            ("m2", 30, 1.0, "05:01", 10, 9),
        ]
    )
    goals_m1 = detect_goals(con, "m1")
    goals_m2 = detect_goals(con, "m2")
    assert len(goals_m1) == 1 and goals_m1[0].team == "home"
    assert len(goals_m2) == 1 and goals_m2[0].team == "away"
