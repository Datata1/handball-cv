"""
Ball detector.

Port target: CV-POC-Wels/pipeline/detector.py
Key decisions made vs. POC:
  - Separate class from PersonDetector so both can be developed independently
  - Returns a single Detection (the highest-confidence ball) or None
  - Uses custom single-class ball model (class 0) with max_det=1
"""

from __future__ import annotations

from typing import Any

import numpy as np

from ingestion.device import yolo_precision_kwargs
from ingestion.types import BoundingBox, Detection

try:
    import ultralytics as _ultralytics  # noqa: F401

    AVAILABLE: bool = True
except ImportError:
    AVAILABLE = False


class BallDetector:
    """YOLO-based handball detector using a custom single-class ball model."""

    _model: Any  # ultralytics.YOLO — imported lazily to respect AVAILABLE guard

    def __init__(
        self,
        model_path: str,
        confidence: float,
        device: str,
        imgsz: int = 640,
        half: bool = False,
    ) -> None:
        import ultralytics

        self._model = ultralytics.YOLO(model_path)
        self._confidence = confidence
        self._device = device
        self._imgsz = imgsz
        # FP16 only makes sense on CUDA; ultralytics raises if half=True on CPU
        self._half = half and device != "cpu"
        self._precision = yolo_precision_kwargs(self._half)

    def detect(self, frame: np.ndarray) -> Detection | None:  # type: ignore[type-arg]
        """
        Run YOLO on one frame and return the highest-confidence ball detection.

        Returns None if no ball is visible above the confidence threshold.
        track_id is set to -1 (ball tracking is not required for analytics).
        max_det=1: assume at most one ball per frame.
        """
        results = self._model.predict(
            frame,
            conf=self._confidence,
            max_det=1,
            device=self._device,
            imgsz=self._imgsz,
            verbose=False,
            **self._precision,
        )
        for r in results:
            if r.boxes is None or len(r.boxes) == 0:
                continue
            box = r.boxes[0]
            xyxy = box.xyxy[0].cpu().numpy().astype(int)
            x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
            return Detection(
                track_id=-1,
                bbox=BoundingBox(x1, y1, x2, y2),
                confidence=float(box.conf[0]),
            )
        return None
