"""
Person detector.

Port target: CV-POC-Wels/pipeline/detector.py
Key decisions made vs. POC:
  - Returns typed Detection dataclasses instead of raw dicts
  - track_id is assigned by ByteTrack (built into ultralytics); this class does not
    implement its own tracker
  - Ball detection is a separate stage (see ball.py)
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

from ingestion.device import yolo_precision_kwargs
from ingestion.types import BoundingBox, Detection

# Use our custom BoT-SORT config (sparseOptFlow GMC, track_buffer=60, ReID) when
# it exists alongside the package, otherwise fall back to the ultralytics built-in.
# detection.py lives at  src/ingestion/pipeline/detection.py  →  parents[3] = package root
_CUSTOM_TRACKER = Path(__file__).resolve().parents[3] / "botsort_custom.yaml"
_TRACKER_YAML = str(_CUSTOM_TRACKER) if _CUSTOM_TRACKER.exists() else "botsort.yaml"

try:
    import ultralytics

    AVAILABLE: bool = True
except ImportError:
    AVAILABLE = False


class PersonDetector:
    """Modell + Tracker für die Spielererkennung."""

    _model: Any  # ultralytics.YOLO — imported lazily to respect AVAILABLE guard

    def __init__(
        self,
        model_path: str,
        confidence: float,
        max_persons: int,
        device: str,
        imgsz: int = 1280,
        half: bool = False,
    ) -> None:
        self._model = ultralytics.YOLO(model_path)
        self._model.to(device)
        self._confidence = confidence
        self._max_persons = max_persons
        self._imgsz = imgsz
        # FP16 only makes sense on CUDA; ultralytics raises if half=True on CPU
        self._half = half and device != "cpu"
        self._precision = yolo_precision_kwargs(self._half)

    def detect(self, frame: np.ndarray) -> list[Detection]:  # type: ignore[type-arg]
        """
        Run Model + Tracker on one frame.

        Returns tracked player detections sorted by confidence descending.
        track_id is stable across frames via ByteTrack; -1 if tracking is lost.
        """
        results = self._model.track(
            frame,
            conf=self._confidence,
            imgsz=self._imgsz,
            persist=True,
            tracker=_TRACKER_YAML,
            verbose=False,
            **self._precision,
        )
        detections: list[Detection] = []
        for r in results:
            if r.boxes is None:
                continue
            class_names: dict[int, str] = getattr(r, "names", {}) or {}
            for box in r.boxes:
                xyxy = box.xyxy[0].cpu().numpy().astype(int)
                x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
                track_id = int(box.id[0]) if box.id is not None else -1
                if track_id == -1:
                    continue  # skip untracked detections — they cause PK conflicts
                cls_id = int(box.cls[0]) if box.cls is not None else -1
                cls_name = class_names.get(cls_id, "unknown")
                detections.append(
                    Detection(
                        track_id=track_id,
                        bbox=BoundingBox(x1, y1, x2, y2),
                        confidence=float(box.conf[0]),
                        class_name=cls_name,
                    )
                )
        detections.sort(key=lambda d: d.confidence, reverse=True)
        return detections[: self._max_persons]
