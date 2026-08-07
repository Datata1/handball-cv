"""
Pose keypoint detector for handball court.

Detects the 24 handball court keypoints (court corners, 6m lines, 7m lines, etc.)
using YOLO-Pose. These keypoints are then used to estimate the homography matrix
that maps pixel coordinates to real-world court coordinates.

Port source: temp/infer_in_image.py
"""

from __future__ import annotations

from typing import Any

import numpy as np

from ingestion.pipeline.court_reference import NUM_KEYPOINTS

try:
    import ultralytics  # noqa: F401

    AVAILABLE: bool = True
except ImportError:
    AVAILABLE = False


class PoseDetector:
    """YOLO-Pose detector for handball court keypoints."""

    _model: Any  # ultralytics.YOLO — imported lazily to respect AVAILABLE guard

    def __init__(
        self,
        model_path: str,
        confidence: float,
        device: str,
        imgsz: int = 1280,
    ) -> None:
        import ultralytics

        self._model = ultralytics.YOLO(model_path)
        self._model.to(device)
        self._confidence = confidence
        self._imgsz = imgsz

    def detect(self, frame: np.ndarray) -> list[tuple[float, float] | None]:  # type: ignore[type-arg]
        """Detect 24 court keypoints in a single frame.

        Returns a list of 24 elements, where each element is either:
        - ``(x, y)``: pixel coordinates of the keypoint
        - ``None``: keypoint was not detected or confidence too low
        """
        results = self._model(frame, imgsz=self._imgsz, verbose=False)

        points: list[tuple[float, float] | None] = [None] * NUM_KEYPOINTS

        if not results or len(results) == 0:
            return points

        result = results[0]

        if not hasattr(result, "keypoints") or result.keypoints is None:
            return points

        if result.boxes is None or len(result.boxes) == 0:
            return points

        # Get the detection with highest confidence
        confs = result.boxes.conf.cpu().numpy()
        if len(confs) == 0:
            return points

        best_idx = int(np.argmax(confs))

        if float(confs[best_idx]) < self._confidence:
            return points

        # Extract keypoints for the best detection
        kpts = result.keypoints[best_idx]
        kpt_data = kpts.data.cpu().numpy()

        # Handle both 2D and 3D keypoint data
        if kpt_data.ndim == 3:
            kpt_data = kpt_data[0]

        for i in range(min(NUM_KEYPOINTS, len(kpt_data))):
            x = float(kpt_data[i][0])
            y = float(kpt_data[i][1])
            vis = float(kpt_data[i][2]) if kpt_data.shape[-1] >= 3 else 1.0

            if vis > 0.5 and x > 0 and y > 0:
                points[i] = (x, y)

        return points
