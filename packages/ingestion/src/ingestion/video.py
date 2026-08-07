from collections.abc import Iterator
from pathlib import Path
from typing import NamedTuple

import cv2
import numpy as np


def _video_total_frames(video_path: Path) -> tuple[int, float]:
    """Return (total_frames, fps) without reading any pixel data."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    return total, fps


class VideoFrame(NamedTuple):
    frame_id: int
    frame: np.ndarray  # type: ignore[type-arg]
    timestamp_s: float
    fps: float
    total_frames: int


def iter_sampled_frames(video_path: Path, n_samples: int) -> Iterator[VideoFrame]:
    """Yield *n_samples* frames evenly distributed across the whole video.

    Uses CAP_PROP_POS_FRAMES to seek directly, so only the selected frames
    are decoded — much faster than iterating all frames and skipping.
    """
    total, fps = _video_total_frames(video_path)
    if total <= 0:
        return

    step = max(1, total // n_samples)
    indices = range(0, total, step)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    try:
        for frame_id in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_id)
            ok, frame = cap.read()
            if not ok:
                continue
            yield VideoFrame(
                frame_id=frame_id,
                frame=frame,
                timestamp_s=frame_id / fps,
                fps=fps,
                total_frames=total,
            )
    finally:
        cap.release()


def iter_frames(video_path: Path, stride: int = 1) -> Iterator[VideoFrame]:
    """
    Yield one VideoFrame per frame in display order.

    Args:
        stride: Only yield every Nth frame (stride=2 → half the frames, 2x faster).
                frame_id reflects the original frame number so timestamps stay correct.

    Uses a try/finally so the VideoCapture is always released, even if the
    caller breaks out of the loop early.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_id = 0

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_id % stride == 0:
                yield VideoFrame(
                    frame_id=frame_id,
                    frame=frame,
                    timestamp_s=frame_id / fps,
                    fps=fps,
                    total_frames=total_frames,
                )
            frame_id += 1
    finally:
        cap.release()
