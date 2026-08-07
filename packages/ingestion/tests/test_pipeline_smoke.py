"""
End-to-end pipeline smoke test — no GPU, no real video.

Verifies that IngestionOrchestrator:
  1. Constructs without error when all CV stages are unavailable / not ported
  2. Writes one row per frame to the DuckDB 'frames' table
  3. Registers the match (fps, total_frames) in the 'matches' table
  4. Produces a non-empty annotated MP4 when --output-video is given
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import pytest

from ingestion.config import IngestionSettings
from ingestion.orchestrator import IngestionOrchestrator


@pytest.mark.pipeline
def test_pipeline_writes_frames_to_duckdb(synthetic_video: Path, tmp_path: Path) -> None:
    settings = IngestionSettings(
        duckdb_path=tmp_path / "test.duckdb",
        device="cpu",
        team_warmup_frames=2,
    )
    orchestrator = IngestionOrchestrator(settings)
    out_video = tmp_path / "annotated.mp4"
    orchestrator.run(synthetic_video, "smoke_001", output_video_path=out_video)

    conn = duckdb.connect(str(tmp_path / "test.duckdb"))
    frame_count = conn.execute(
        "SELECT COUNT(*) FROM frames WHERE match_id = 'smoke_001'"
    ).fetchone()
    assert frame_count is not None
    assert frame_count[0] == 5, f"Expected 5 frame rows, got {frame_count[0]}"

    match_row = conn.execute(
        "SELECT fps, total_frames FROM matches WHERE match_id = 'smoke_001'"
    ).fetchone()
    assert match_row is not None
    assert match_row[0] == pytest.approx(25.0)
    assert match_row[1] == 5
    conn.close()

    assert out_video.exists(), "Annotated video was not written"
    assert out_video.stat().st_size > 0, "Annotated video is empty"


@pytest.mark.pipeline
def test_pipeline_without_output_video(synthetic_video: Path, tmp_path: Path) -> None:
    settings = IngestionSettings(
        duckdb_path=tmp_path / "test2.duckdb",
        device="cpu",
        team_warmup_frames=2,
    )
    orchestrator = IngestionOrchestrator(settings)
    orchestrator.run(synthetic_video, "smoke_002")

    conn = duckdb.connect(str(tmp_path / "test2.duckdb"))
    count = conn.execute("SELECT COUNT(*) FROM frames").fetchone()
    assert count is not None and count[0] == 5
    conn.close()
