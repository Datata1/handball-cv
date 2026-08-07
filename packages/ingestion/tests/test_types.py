"""Unit tests for the ingestion type layer — no GPU, no video files needed."""

from ingestion.types import BoundingBox, FrameState, PlayerState


def test_bounding_box_center() -> None:
    bbox = BoundingBox(x1=100, y1=50, x2=200, y2=250)
    assert bbox.center == (150.0, 150.0)


def test_bounding_box_foot() -> None:
    bbox = BoundingBox(x1=100, y1=50, x2=200, y2=250)
    assert bbox.foot == (150.0, 250.0)


def test_frame_state_counts() -> None:
    bbox = BoundingBox(0, 0, 10, 20)
    players = [
        PlayerState(track_id=1, bbox=bbox, confidence=0.9, team="A", on_court=True),
        PlayerState(track_id=2, bbox=bbox, confidence=0.8, team="B", on_court=True),
        PlayerState(track_id=3, bbox=bbox, confidence=0.7, team="A", on_court=False),
    ]
    state = FrameState(frame_id=0, timestamp_s=0.0, players=players, ball=None)

    assert state.player_count == 3
    assert state.on_court_count == 2
