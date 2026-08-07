"""Tests for the scoreboard summary endpoint (/matches/{match_id}/scoreboard/summary)."""

import duckdb
import pytest
from httpx import AsyncClient

import backend.db as db_module
from backend.config import settings

MATCH_ID = "test-match-001"


@pytest.fixture
def seeded_duckdb(tmp_path, monkeypatch):
    """Points the backend at a throwaway DuckDB file seeded with scoreboard test data."""
    db_path = tmp_path / "matches.duckdb"
    conn = duckdb.connect(str(db_path))
    conn.execute(
        """
        CREATE TABLE scoreboard_readings (
            match_id      VARCHAR NOT NULL,
            frame_number  INTEGER NOT NULL,
            timestamp_sec DOUBLE NOT NULL,
            game_time     VARCHAR,
            score_home    INTEGER,
            score_away    INTEGER,
            PRIMARY KEY (match_id, frame_number)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE goal_events (
            match_id      VARCHAR NOT NULL,
            frame_number  INTEGER NOT NULL,
            timestamp_sec DOUBLE NOT NULL,
            game_time     VARCHAR,
            team          VARCHAR NOT NULL,
            score_home    INTEGER NOT NULL,
            score_away    INTEGER NOT NULL,
            PRIMARY KEY (match_id, frame_number)
        )
        """
    )
    conn.executemany(
        "INSERT INTO scoreboard_readings VALUES (?, ?, ?, ?, ?, ?)",
        [
            (MATCH_ID, 10, 1.0, "00:30", 0, 0),
            (MATCH_ID, 500, 60.0, "12:15", 1, 0),
            (MATCH_ID, 1800, 220.0, "29:50", 1, 1),
        ],
    )
    conn.executemany(
        "INSERT INTO goal_events VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (MATCH_ID, 500, 60.0, "12:15", "home", 1, 0),
            (MATCH_ID, 1800, 220.0, "29:50", "away", 1, 1),
        ],
    )
    conn.close()

    monkeypatch.setattr(settings, "duckdb_path", str(db_path))
    monkeypatch.setattr(db_module, "all_statuses", lambda: {})
    return db_path


async def test_scoreboard_summary_returns_final_score_and_goals(
    client: AsyncClient, seeded_duckdb
) -> None:
    response = await client.get(f"/api/v1/matches/{MATCH_ID}/scoreboard/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["match_id"] == MATCH_ID
    assert body["final_score_home"] == 1
    assert body["final_score_away"] == 1
    assert body["final_game_time"] == "29:50"
    assert [g["frame_number"] for g in body["goals"]] == [500, 1800]
    assert body["goals"][0]["team"] == "home"
    assert body["goals"][1]["team"] == "away"
    assert body["goals"][1]["score_home"] == 1
    assert body["goals"][1]["score_away"] == 1


async def test_scoreboard_summary_404_when_no_readings(client: AsyncClient, seeded_duckdb) -> None:
    response = await client.get("/api/v1/matches/unknown-match/scoreboard/summary")

    assert response.status_code == 404
