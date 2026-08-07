"""
Core data types for the ingestion pipeline.

Each stage of the pipeline transforms one type into the next:
  frame (np.ndarray)
    → Detection          (detector)
    → PlayerState        (pose estimator + team classifier + court mapper)
    → FrameState         (assembler)
    → DuckDB rows        (writer)
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BoundingBox:
    x1: int
    y1: int
    x2: int
    y2: int

    @property
    def center(self) -> tuple[float, float]:
        return ((self.x1 + self.x2) / 2.0, (self.y1 + self.y2) / 2.0)

    @property
    def foot(self) -> tuple[float, float]:
        """Bottom-center of the bounding box — used as the player's ground position."""
        return ((self.x1 + self.x2) / 2.0, float(self.y2))

    @property
    def width(self) -> int:
        return self.x2 - self.x1

    @property
    def height(self) -> int:
        return self.y2 - self.y1


@dataclass(frozen=True)
class Detection:
    """
    Raw output from the detector — no team, no court position, no pose.
    track_id is stable across frames (assigned by ByteTrack).
    """

    track_id: int
    bbox: BoundingBox
    confidence: float
    class_name: str = "unknown"  # YOLO class label (e.g. "player", "goalkeeper", "referee")


@dataclass
class PlayerState:
    """
    Fully enriched player state for one frame.
    Built by assembling Detection + pose + team + court mapping.
    """

    track_id: int
    bbox: BoundingBox
    confidence: float
    team: str  # "A" | "B" | "unknown"
    court_pos: tuple[float, float] | None = None
    on_court: bool = True

    @property
    def foot_px(self) -> tuple[float, float]:
        return self.bbox.foot


@dataclass
class BallState:
    bbox: BoundingBox
    confidence: float
    court_pos: tuple[float, float] | None = None

    @property
    def center_px(self) -> tuple[float, float]:
        return self.bbox.center


@dataclass
class FrameState:
    frame_id: int
    timestamp_s: float
    players: list[PlayerState]
    ball: BallState | None

    @property
    def player_count(self) -> int:
        return len(self.players)

    @property
    def on_court_count(self) -> int:
        return sum(1 for p in self.players if p.on_court)
