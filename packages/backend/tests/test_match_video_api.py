"""Tests for the inline match video endpoint and its original/annotated switch."""

import pytest
from httpx import AsyncClient

import backend.routes.matches as matches_module
import backend.routes.upload as upload_module

MATCH_ID = "match-1"
ORIGINAL = b"original video bytes"
ANNOTATED = b"annotated video bytes"


@pytest.fixture
def video_files(tmp_path, monkeypatch):
    """Both files on disk, with the database pointing at the uploaded one."""
    output = tmp_path / "output"
    output.mkdir()
    original = tmp_path / "match.mp4"
    original.write_bytes(ORIGINAL)

    monkeypatch.setattr(upload_module, "DATA_OUTPUT_VIDEOS", output)
    monkeypatch.setattr(
        matches_module,
        "query_duckdb",
        lambda *args, **kwargs: [{"video_path": str(original)}],
    )

    return output / f"{MATCH_ID}_annotated.mp4"


async def test_serves_the_original_when_nothing_has_been_rendered(
    client: AsyncClient, video_files
) -> None:
    response = await client.get(f"/api/v1/matches/{MATCH_ID}/video")

    assert response.status_code == 200
    assert response.content == ORIGINAL


async def test_prefers_the_annotated_render_by_default(client: AsyncClient, video_files) -> None:
    video_files.write_bytes(ANNOTATED)

    response = await client.get(f"/api/v1/matches/{MATCH_ID}/video")

    assert response.status_code == 200
    assert response.content == ANNOTATED


async def test_source_original_ignores_the_annotated_render(
    client: AsyncClient, video_files
) -> None:
    # The half the report's toggle could not express before: an annotated file
    # existing used to mean the original was unreachable inline.
    video_files.write_bytes(ANNOTATED)

    response = await client.get(f"/api/v1/matches/{MATCH_ID}/video", params={"source": "original"})

    assert response.status_code == 200
    assert response.content == ORIGINAL


async def test_source_annotated_serves_the_render(client: AsyncClient, video_files) -> None:
    video_files.write_bytes(ANNOTATED)

    response = await client.get(f"/api/v1/matches/{MATCH_ID}/video", params={"source": "annotated"})

    assert response.status_code == 200
    assert response.content == ANNOTATED


async def test_source_annotated_does_not_fall_back(client: AsyncClient, video_files) -> None:
    response = await client.get(f"/api/v1/matches/{MATCH_ID}/video", params={"source": "annotated"})

    assert response.status_code == 404


async def test_rejects_an_unknown_source(client: AsyncClient, video_files) -> None:
    response = await client.get(f"/api/v1/matches/{MATCH_ID}/video", params={"source": "raw"})

    assert response.status_code == 422


async def test_plays_inline_and_supports_seeking(client: AsyncClient, video_files) -> None:
    # What makes this endpoint usable as a <video src> at all: no attachment
    # disposition, and range requests so the player can seek.
    response = await client.get(f"/api/v1/matches/{MATCH_ID}/video")

    assert response.headers["content-type"] == "video/mp4"
    assert "attachment" not in response.headers.get("content-disposition", "")
    assert response.headers.get("accept-ranges") == "bytes"


async def test_missing_match_is_a_404(client: AsyncClient, monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(upload_module, "DATA_OUTPUT_VIDEOS", tmp_path)
    monkeypatch.setattr(matches_module, "query_duckdb", lambda *args, **kwargs: [])

    response = await client.get(f"/api/v1/matches/{MATCH_ID}/video")

    assert response.status_code == 404
