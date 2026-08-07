"""Shared pytest fixtures for ingestion tests."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import pytest


@pytest.fixture(scope="session")
def synthetic_video(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """
    Write a tiny 5-frame synthetic MP4 using only numpy + opencv.
    No GPU, no real video required. 320x240, 25 fps.
    Each frame has a moving white rectangle to simulate a detection region.
    """
    out = tmp_path_factory.mktemp("fixtures") / "test_video.mp4"
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")  # type: ignore[attr-defined]
    writer = cv2.VideoWriter(str(out), fourcc, 25.0, (320, 240))
    for i in range(5):
        frame = np.zeros((240, 320, 3), dtype=np.uint8)
        x = 50 + i * 10
        cv2.rectangle(frame, (x, 80), (x + 60, 180), (255, 255, 255), -1)
        writer.write(frame)
    writer.release()
    assert out.exists(), "VideoWriter failed to create synthetic video"
    return out
