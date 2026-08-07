# Porting Pipeline Stages — Developer Guide

This guide covers everything you need to port one of the four CV pipeline stages
from the POC into the monorepo ingestion package. Each stage is an independent
user story; you can work on yours without any other stage being implemented.

---

## How the Pipeline Works

```
Video frame (np.ndarray)
      │
      ├──▶  PersonDetector.detect()    →  list[Detection]
      │
      ├──▶  BallDetector.detect()      →  Detection | None
      │
      ├──▶  TeamClassifier.classify()  →  "A" | "B" | "unknown"  (per player)
      │
      └──▶  CourtMapper.transform()    →  (court_x, court_y) | None
                  │
                  ▼
            FrameState → FrameWriter → DuckDB
```

Person detection, ball detection, team classification, and court mapping are
**four independent stages**. Each can be developed and merged on its own.

If a stage raises `NotImplementedError` or its dependencies are not installed,
the orchestrator skips it silently. A pipeline with zero stages implemented still
writes frame timestamps to DuckDB.

---

## The Modularity Contract

Every pipeline module exports a module-level `AVAILABLE: bool`. The orchestrator
checks this flag before attempting to construct a stage.

```python
# pipeline/detection.py
try:
    import ultralytics as _ultralytics  # noqa: F401
    AVAILABLE: bool = True
except ImportError:
    AVAILABLE = False
```

- `AVAILABLE = True` means **"my dependencies are importable"** — not "I am ported."
- The stage's `__init__` still raises `NotImplementedError` until ported.
- When you finish porting, remove the `raise NotImplementedError` lines.

### The lifecycle of a stage

```
Before porting:   AVAILABLE=False (or True)  __init__ raises NotImplementedError
                  → orchestrator skips, logs a warning

After porting:    AVAILABLE=True             __init__ + methods fully implemented
                  → orchestrator constructs and uses the stage
```

---

## Stages Overview

| Stage | File | POC reference | Dependencies |
|-------|------|---------------|-------------|
| Person detection | `pipeline/detection.py` | `pipeline/detector.py` | `ultralytics` (`[cv]`) |
| Ball detection | `pipeline/ball.py` | `pipeline/detector.py` | `ultralytics` (`[cv]`) |
| Team classification | `pipeline/team.py` | `pipeline/team.py` | `scikit-learn`, `opencv` (core) |
| Court mapping | `pipeline/court.py` | `pipeline/court.py` | `opencv` (core) |

POC code lives at `/home/datata1/Documents/wels/pipeline/` — read it before you
start, it is working reference code.

---

## Stage 1 — PersonDetector (`pipeline/detection.py`)

### What it does

Runs YOLO11 + ByteTrack on a single frame to produce a list of **tracked player
detections** with stable `track_id`s across frames.

### Stub interface

```python
class PersonDetector:
    def __init__(
        self,
        model_path: str,
        confidence: float,
        max_persons: int,
        device: str,
    ) -> None: ...

    def detect(self, frame: np.ndarray) -> list[Detection]: ...
```

`Detection` is a frozen dataclass (`types.py`):

```python
@dataclass(frozen=True)
class Detection:
    track_id: int
    bbox: BoundingBox   # x1, y1, x2, y2 as int
    confidence: float
```

### Porting from POC

The POC has a module-level function `detect_and_track()` in `pipeline/detector.py`.
Adapt its person-detection branch into the class:

1. **`__init__`** — load the YOLO model:

   ```python
   from ultralytics import YOLO

   self._model = YOLO(model_path)
   self._model.to(device)
   self._confidence = confidence
   self._max_persons = max_persons
   ```

2. **`detect()`** — run tracking, convert raw dicts to `Detection` dataclasses:

   ```python
   results = self._model.track(
       frame,
       classes=[0],          # COCO class 0 = person
       conf=self._confidence,
       imgsz=1280,
       persist=True,
       tracker="bytetrack.yaml",
       verbose=False,
   )
   detections = []
   for r in results:
       for box in r.boxes:
           x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
           track_id = int(box.id[0]) if box.id is not None else -1
           detections.append(Detection(
               track_id=track_id,
               bbox=BoundingBox(int(x1), int(y1), int(x2), int(y2)),
               confidence=float(box.conf[0]),
           ))
   detections.sort(key=lambda d: d.confidence, reverse=True)
   return detections[: self._max_persons]
   ```

### Key decisions vs POC

- Only detects **persons** (class 0). Ball detection is `BallDetector` (separate stage).
- `track_id` comes from ByteTrack via `box.id`. Use `persist=True` across frames.
- If ByteTrack loses a track, `box.id` is `None` — return `-1` for that detection.

---

## Stage 2 — BallDetector (`pipeline/ball.py`)

### What it does

Runs YOLO on a single frame and returns the **single highest-confidence ball
detection**, or `None` if the ball is not visible.

### Stub interface

```python
class BallDetector:
    def __init__(
        self,
        model_path: str,
        confidence: float,
        device: str,
    ) -> None: ...

    def detect(self, frame: np.ndarray) -> Detection | None: ...
```

The return value is one `Detection` (or `None`). `track_id` is set to `-1` —
ball tracking across frames is not needed for the analytics workload.

### Porting from POC

Use the ball-detection branch from `detect_and_track()` in `pipeline/detector.py`:

1. **`__init__`** — load the YOLO model, decide which class to target:

   ```python
   from ultralytics import YOLO

   self._model = YOLO(model_path)
   self._model.to(device)
   self._confidence = confidence
   # Generic COCO model uses class 32 (sports ball).
   # A custom single-class ball model uses class 0.
   # The simplest approach: always use class 32 if using yolo11m.pt,
   # or detect what the model is and set the class accordingly.
   self._ball_class = 32  # override to 0 for custom models
   ```

2. **`detect()`** — run inference, pick the best detection:

   ```python
   results = self._model(
       frame,
       classes=[self._ball_class],
       conf=self._confidence,
       imgsz=1280,
       verbose=False,
   )
   best: dict | None = None
   for r in results:
       for box in r.boxes:
           conf = float(box.conf[0])
           if best is None or conf > best["conf"]:
               x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
               best = {"bbox": (int(x1), int(y1), int(x2), int(y2)), "conf": conf}
   if best is None:
       return None
   return Detection(
       track_id=-1,
       bbox=BoundingBox(*best["bbox"]),
       confidence=best["conf"],
   )
   ```

### Key decisions vs POC

- The ball detector does **not** use ByteTrack (`persist=False`, no `tracker=`).
  Ball tracking is not needed for the downstream analytics.
- Returns at most **one** detection — the highest-confidence ball in the frame.
- Uses `model()` (inference) not `model.track()` (tracking) for simplicity.

---

## Stage 3 — TeamClassifier (`pipeline/team.py`)

### What it does

Clusters players into teams using jersey color (HSV histogram of the torso
region + K-Means). Uses an **explicit warm-up → fit → classify** state machine:

```
Phase 1: for each frame, call collect() for each player bbox
Phase 2: call fit() once — trains K-Means on accumulated samples
Phase 3: for each frame, call classify() per player → "A" | "B" | "unknown"
```

### Stub interface

```python
class TeamClassifier:
    def __init__(self, n_teams: int = 2) -> None: ...

    def collect(self, frame: np.ndarray, bbox: BoundingBox) -> None: ...
    def fit(self) -> None: ...
    def classify(self, frame: np.ndarray, bbox: BoundingBox) -> str: ...
```

`classify()` returns `"unknown"` (without raising) if `fit()` has not been called
yet — this is intentional for the warm-up phase.

### Porting from POC

> ⚠️ The POC's `TeamClassifier` has a **different API** (all-in-one `classify()`
> with implicit refitting). The monorepo stub uses an explicit 3-phase design.
> You are porting the logic, not copy-pasting the class.

1. **`__init__`** — initialise the sample buffer and KMeans:

   ```python
   from sklearn.cluster import KMeans

   self._n_teams = n_teams
   self._fitted = False
   self._samples: list[np.ndarray] = []
   self._kmeans: KMeans | None = None
   self._label_map: dict[int, str] = {}
   ```

2. **`collect()`** — extract one HSV histogram, append to buffer.
   Copy `_extract_torso_hist()` directly from the POC:

   ```python
   hist = _extract_torso_hist(frame, (bbox.x1, bbox.y1, bbox.x2, bbox.y2))
   if hist is not None:
       self._samples.append(hist)
   ```

3. **`fit()`** — fit K-Means, build a stable label map:

   ```python
   if len(self._samples) < 2 * self._n_teams:
       raise RuntimeError("Not enough samples to fit team classifier")
   arr = np.array(self._samples)
   self._kmeans = KMeans(n_clusters=self._n_teams, n_init=10, random_state=42)
   self._kmeans.fit(arr)
   centers = self._kmeans.cluster_centers_
   order = sorted(range(self._n_teams), key=lambda c: np.argmax(centers[c][:16]))
   labels = ["A", "B", "C", "D"][: self._n_teams]
   self._label_map = {order[j]: labels[j] for j in range(self._n_teams)}
   self._fitted = True
   ```

4. **`classify()`** — extract histogram, predict, map to label:

   ```python
   if not self._fitted:
       return "unknown"
   hist = _extract_torso_hist(frame, (bbox.x1, bbox.y1, bbox.x2, bbox.y2))
   if hist is None:
       return "unknown"
   cluster = int(self._kmeans.predict([hist])[0])
   return self._label_map.get(cluster, "unknown")
   ```

### Key decisions vs POC

- `_extract_torso_hist()` crops the **middle 40% vertically, center 60%
  horizontally** of the bbox — avoids shorts (bottom) and head (top).
- The warm-up frame count is set by `IngestionSettings.team_warmup_frames`
  (default 150). The orchestrator handles the warm-up loop.
- Label assignment ("A"/"B") is stable within a run but arbitrary across
  matches — the backend maps these to real team names.

---

## Stage 4 — CourtMapper (`pipeline/court.py`)

### What it does

Applies a homography matrix to map a pixel position `(px, py)` to a real-world
court position in metres. Returns `None` if the mapped point falls outside the
valid court bounds `[0–40] × [0–20]` metres.

### Stub interface

```python
class CourtMapper:
    def __init__(
        self,
        src_points: list[list[float]],   # pixel coords, ≥4 points
        dst_points: list[list[float]],   # court coords in metres
    ) -> None: ...

    @classmethod
    def from_file(cls, path: Path) -> CourtMapper: ...   # already implemented

    def transform(self, pixel_pos: tuple[float, float]) -> tuple[float, float] | None: ...
```

`from_file()` reads a JSON calibration file and calls `cls(data["src"], data["dst"])`.
It is already implemented and does not need to be ported.

The calibration file format (produced by `calibrate.py` in the CV-POC):
```json
{
  "src": [[px1, py1], [px2, py2], [px3, py3], [px4, py4]],
  "dst": [[0, 0], [40, 0], [40, 20], [0, 20]]
}
```

### Porting from POC

1. **`__init__`** — compute the homography matrix:

   ```python
   import cv2
   import numpy as np

   src = np.float32(src_points)
   dst = np.float32(dst_points)
   self._H, _ = cv2.findHomography(src, dst)
   ```

2. **`transform()`** — apply the matrix, check bounds:

   ```python
   pt = np.float32([[[pixel_pos[0], pixel_pos[1]]]])
   mapped = cv2.perspectiveTransform(pt, self._H)
   cx, cy = float(mapped[0][0][0]), float(mapped[0][0][1])
   if 0.0 <= cx <= 40.0 and 0.0 <= cy <= 20.0:
       return (cx, cy)
   return None
   ```

### Key decisions vs POC

- `transform()` takes a single `(x, y)` tuple (not two separate args like the
  POC's `pixel_to_court(px, py)`).
- Return `None` for out-of-bounds — the orchestrator sets `court_pos=None`
  on the player/ball state cleanly.
- This stage is optional: leave `calibration_path` unset (or omit `--calibration`)
  and all `court_pos` values will be `None`.

---

## Testing Your Stage

### 1. Smoke test (no GPU, no video)

```bash
make test-pipeline
```

Runs `tests/test_pipeline_smoke.py` with a synthetic 5-frame video. Verifies
the pipeline constructs and runs end-to-end with whatever stages are currently
implemented. Once you port your stage, it will be exercised automatically.

If your stage requires a model file to load, guard the test:

```python
import pytest
from pathlib import Path

pytestmark = pytest.mark.skipif(
    not Path("data/input/models/yolo11m.pt").exists(),
    reason="model weights not present",
)
```

### 2. Unit tests for your stage

Add `tests/test_<stage>.py` marked `@pytest.mark.unit` (no GPU) or
`@pytest.mark.integration` (real model + video).

Example for the person detector (mock YOLO output):

```python
from unittest.mock import MagicMock, patch
import numpy as np
import pytest
from ingestion.pipeline.detection import PersonDetector, AVAILABLE
from ingestion.types import Detection

@pytest.mark.unit
@pytest.mark.skipif(not AVAILABLE, reason="ultralytics not installed")
def test_detect_returns_typed_detections():
    with patch("ingestion.pipeline.detection.YOLO") as MockYOLO:
        # configure mock results here ...
        detector = PersonDetector(model_path="yolo11m.pt", confidence=0.3,
                                  max_persons=20, device="cpu")
        players = detector.detect(np.zeros((480, 640, 3), dtype=np.uint8))
        assert all(isinstance(p, Detection) for p in players)
```

### 3. Integration test (real video)

```bash
cd packages/ingestion
uv run pytest -m integration -v
```

Mark tests with `@pytest.mark.integration`. Place a real video in
`data/input/videos/`. Integration tests are excluded from CI.

### 4. Manual end-to-end run

```bash
cd packages/ingestion
uv run wels-ingest data/input/videos/match.mp4 test_001 \
    --device cpu \
    --output-video /tmp/annotated.mp4
```

Inspect the DuckDB output:

```bash
uv run python -c "
import duckdb
c = duckdb.connect('data/output/duckdb/matches.duckdb')
print(c.execute('SELECT frame_id, player_count, on_court_count FROM frames LIMIT 10').df())
"
```

---

## Installing CV Dependencies

`ultralytics` and `torch` are in the `[cv]` optional group — not installed by
default (CI runs without them).

```bash
cd packages/ingestion
uv sync --all-extras
```

Confirm availability:

```bash
uv run python -c "from ingestion.pipeline.detection import AVAILABLE; print('person det:', AVAILABLE)"
uv run python -c "from ingestion.pipeline.ball import AVAILABLE; print('ball det:', AVAILABLE)"
```

---

### testing the pipeline

run from root

```sh
uv run --project packages/ingestion wels-ingest data/input/videos/dev_test_clip.mp4 match_004 --output-video data/output/dev_test_annotated4.mp4 --no-half
```

## Checklist for Submitting a Stage PR

- [ ] `AVAILABLE` flag in place and evaluated at import time
- [ ] `__init__` no longer raises `NotImplementedError`
- [ ] All public methods no longer raise `NotImplementedError`
- [ ] Return types match the stub exactly (typed dataclasses, not raw dicts)
- [ ] `make test-pipeline` passes (0 failures)
- [ ] At least one unit test added for the new stage
- [ ] `make lint` and `make typecheck` pass
