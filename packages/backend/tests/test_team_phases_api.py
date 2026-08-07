"""Tests for the team-phases endpoint (/matches/{match_id}/team-phases)."""

import duckdb
import pytest
from httpx import AsyncClient

import backend.db as db_module
from backend.config import settings

MATCH_ID = "test-match-001"


@pytest.fixture
def seeded_duckdb(tmp_path, monkeypatch):
    """Points the backend at a throwaway DuckDB file seeded with team-phase data."""
    db_path = tmp_path / "matches.duckdb"
    conn = duckdb.connect(str(db_path))
    conn.execute(
        """
        CREATE TABLE team_phases (
            match_id      TEXT    NOT NULL,
            phase_id      INTEGER NOT NULL,
            offense_team  TEXT    NOT NULL,
            defense_team  TEXT    NOT NULL,
            phase_type    TEXT    NOT NULL,
            start_frame   INTEGER NOT NULL,
            end_frame     INTEGER NOT NULL,
            start_time_s  DOUBLE  NOT NULL,
            end_time_s    DOUBLE  NOT NULL,
            PRIMARY KEY (match_id, phase_id)
        )
        """
    )
    conn.executemany(
        "INSERT INTO team_phases VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (MATCH_ID, 1, "B", "A", "transition", 300, 500, 12.0, 20.0),
            (MATCH_ID, 0, "A", "B", "attack", 0, 200, 0.0, 8.0),
            (MATCH_ID, 2, "A", "B", "attack", 600, 900, 24.0, 36.0),
        ],
    )
    conn.close()

    monkeypatch.setattr(settings, "duckdb_path", str(db_path))
    monkeypatch.setattr(db_module, "all_statuses", lambda: {})
    return db_path


async def test_returns_all_phases_ordered_by_start_frame(
    client: AsyncClient, seeded_duckdb
) -> None:
    response = await client.get(f"/api/v1/matches/{MATCH_ID}/team-phases")

    assert response.status_code == 200
    body = response.json()
    assert [p["phase_id"] for p in body] == [0, 1, 2]
    assert body[0] == {
        "phase_id": 0,
        "offense_team": "A",
        "defense_team": "B",
        "phase_type": "attack",
        "start_frame": 0,
        "end_frame": 200,
        "start_time_s": 0.0,
        "end_time_s": 8.0,
    }


async def test_filter_by_phase_type(client: AsyncClient, seeded_duckdb) -> None:
    response = await client.get(f"/api/v1/matches/{MATCH_ID}/team-phases?phase_type=attack")

    assert response.status_code == 200
    body = response.json()
    assert [p["phase_id"] for p in body] == [0, 2]
    assert all(p["phase_type"] == "attack" for p in body)


async def test_filter_by_offense_team(client: AsyncClient, seeded_duckdb) -> None:
    response = await client.get(f"/api/v1/matches/{MATCH_ID}/team-phases?team=B")

    assert response.status_code == 200
    body = response.json()
    assert [p["phase_id"] for p in body] == [1]
    assert body[0]["offense_team"] == "B"
    assert body[0]["defense_team"] == "A"


async def test_unknown_match_returns_empty_list(client: AsyncClient, seeded_duckdb) -> None:
    response = await client.get("/api/v1/matches/unknown-match/team-phases")

    assert response.status_code == 200
    assert response.json() == []
