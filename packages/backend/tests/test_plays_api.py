"""Tests for the play detection endpoints (/matches/{match_id}/plays, /play-summary)."""

import json

import duckdb
import pytest
from httpx import AsyncClient

import backend.db as db_module
from backend.config import settings

MATCH_ID = "test-match-001"


@pytest.fixture
def seeded_duckdb(tmp_path, monkeypatch):
    """Points the backend at a throwaway DuckDB file seeded with play events."""
    db_path = tmp_path / "matches.duckdb"
    conn = duckdb.connect(str(db_path))
    conn.execute(
        """
        CREATE TABLE play_events (
            match_id      TEXT    NOT NULL,
            event_id      INTEGER NOT NULL,
            play_type     TEXT    NOT NULL,
            team          TEXT    NOT NULL,
            start_frame   INTEGER NOT NULL,
            end_frame     INTEGER NOT NULL,
            start_time_s  DOUBLE  NOT NULL,
            end_time_s    DOUBLE  NOT NULL,
            confidence    DOUBLE  NOT NULL,
            track_ids     TEXT    NOT NULL,
            details       TEXT,
            PRIMARY KEY (match_id, event_id)
        )
        """
    )
    details = json.dumps(
        {"goal_x": 40.0, "tracks": [{"track_id": 7, "points": [[4.0, 29.0, 6.0]]}]}
    )
    conn.executemany(
        "INSERT INTO play_events VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [
            (MATCH_ID, 0, "kreuzen", "A", 120, 210, 4.0, 7.0, 0.82, "[7, 9]", details),
            (MATCH_ID, 1, "einlaeufer", "B", 600, 720, 20.0, 24.0, 0.66, "[12]", None),
            (MATCH_ID, 2, "kreuzen", "B", 900, 990, 30.0, 33.0, 0.74, "[15, 18]", None),
        ],
    )
    conn.close()

    monkeypatch.setattr(settings, "duckdb_path", str(db_path))
    monkeypatch.setattr(db_module, "all_statuses", lambda: {})
    return db_path


async def test_plays_returns_all_events_ordered(client: AsyncClient, seeded_duckdb) -> None:
    response = await client.get(f"/api/v1/matches/{MATCH_ID}/plays")
    assert response.status_code == 200
    events = response.json()
    assert [e["event_id"] for e in events] == [0, 1, 2]
    assert events[0]["play_type"] == "kreuzen"
    assert events[0]["track_ids"] == [7, 9]
    assert events[0]["details"]["goal_x"] == 40.0
    assert events[1]["details"] is None


async def test_plays_filters_by_type_and_team(client: AsyncClient, seeded_duckdb) -> None:
    response = await client.get(
        f"/api/v1/matches/{MATCH_ID}/plays", params={"play_type": "kreuzen", "team": "B"}
    )
    assert response.status_code == 200
    events = response.json()
    assert len(events) == 1
    assert events[0]["event_id"] == 2


async def test_plays_unknown_match_returns_empty_list(client: AsyncClient, seeded_duckdb) -> None:
    response = await client.get("/api/v1/matches/does-not-exist/plays")
    assert response.status_code == 200
    assert response.json() == []


async def test_play_summary_counts_per_type_and_team(client: AsyncClient, seeded_duckdb) -> None:
    response = await client.get(f"/api/v1/matches/{MATCH_ID}/play-summary")
    assert response.status_code == 200
    summary = {(s["play_type"], s["team"]): s for s in response.json()}
    assert summary[("kreuzen", "A")]["count"] == 1
    assert summary[("kreuzen", "B")]["count"] == 1
    assert summary[("einlaeufer", "B")]["count"] == 1
    assert summary[("kreuzen", "A")]["avg_confidence"] == pytest.approx(0.82)
