"""Tests for the video upload endpoint and ingestion command construction."""

import pytest
from httpx import AsyncClient

import backend.routes.upload as upload_module
from backend.routes.upload import run_ingestion_pipeline


@pytest.fixture
def upload_env(tmp_path, monkeypatch):
    """Isolate the upload route: tmp dirs, no status files, recorded pipeline calls."""
    calls: list[tuple] = []
    monkeypatch.setattr(upload_module, "DATA_INPUT_VIDEOS", tmp_path / "input")
    monkeypatch.setattr(upload_module, "DATA_OUTPUT_VIDEOS", tmp_path / "output")
    monkeypatch.setattr(upload_module, "write_status", lambda *a, **kw: None)
    monkeypatch.setattr(upload_module, "run_ingestion_pipeline", lambda *args: calls.append(args))
    return calls


async def test_upload_defaults_to_no_annotated_video(client: AsyncClient, upload_env) -> None:
    response = await client.post(
        "/api/v1/videos/upload",
        files={"file": ("match.mp4", b"fake video bytes", "video/mp4")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "processing"
    assert len(upload_env) == 1
    match_id, video_path, annotate_video = upload_env[0]
    assert match_id == body["match_id"]
    assert video_path.endswith("match.mp4")
    assert annotate_video is False


async def test_upload_with_annotate_video_true(client: AsyncClient, upload_env) -> None:
    response = await client.post(
        "/api/v1/videos/upload",
        files={"file": ("match.mp4", b"fake video bytes", "video/mp4")},
        data={"annotate_video": "true"},
    )

    assert response.status_code == 200
    assert len(upload_env) == 1
    assert upload_env[0][2] is True


async def test_upload_rejects_unsupported_extension(client: AsyncClient, upload_env) -> None:
    response = await client.post(
        "/api/v1/videos/upload",
        files={"file": ("match.txt", b"not a video", "text/plain")},
    )

    assert response.status_code == 400
    assert upload_env == []


class TestIngestCommandConstruction:
    @pytest.fixture
    def captured_cmds(self, monkeypatch):
        cmds: list[list[str]] = []

        def fake_run(cmd, cwd, label):
            cmds.append(cmd)
            return True

        monkeypatch.setattr(upload_module, "_run_subprocess", fake_run)
        statuses: list[str] = []
        monkeypatch.setattr(upload_module, "write_status", lambda mid, s: statuses.append(s))
        return cmds, statuses

    def test_default_skips_output_video(self, captured_cmds) -> None:
        cmds, statuses = captured_cmds
        run_ingestion_pipeline("m1", "/videos/m1.mp4")

        ingest_cmd, score_cmd = cmds
        assert "--output-video" not in ingest_cmd
        assert "wels-score" in score_cmd
        assert statuses == ["done"]

    def test_annotate_video_passes_output_flag(self, captured_cmds, tmp_path, monkeypatch) -> None:
        monkeypatch.setattr(upload_module, "DATA_OUTPUT_VIDEOS", tmp_path / "output")
        cmds, statuses = captured_cmds
        run_ingestion_pipeline("m1", "/videos/m1.mp4", annotate_video=True)

        ingest_cmd = cmds[0]
        assert "--output-video" in ingest_cmd
        out_path = ingest_cmd[ingest_cmd.index("--output-video") + 1]
        assert out_path.endswith("m1_annotated.mp4")
        assert statuses == ["done"]
