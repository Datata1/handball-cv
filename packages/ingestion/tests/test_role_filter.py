"""Tests for the handball role-based detection filter."""

from __future__ import annotations

from ingestion.pipeline.role_filter import RoleLimits, filter_by_role
from ingestion.types import BoundingBox, Detection

_BOX = BoundingBox(0, 0, 100, 200)


def _det(track_id: int, class_name: str, confidence: float) -> Detection:
    return Detection(track_id=track_id, bbox=_BOX, confidence=confidence, class_name=class_name)


class TestFilterByRole:
    def test_within_limits_passes_all(self) -> None:
        dets = [
            _det(1, "goalkeeper", 0.9),
            _det(2, "goalkeeper", 0.8),
            _det(3, "player", 0.95),
            _det(4, "referee", 0.7),
        ]
        result = filter_by_role(dets, RoleLimits())
        assert len(result) == 4

    def test_excess_goalkeepers_pruned(self) -> None:
        dets = [
            _det(1, "goalkeeper", 0.95),
            _det(2, "goalkeeper", 0.85),
            _det(3, "goalkeeper", 0.60),  # should be pruned
        ]
        result = filter_by_role(dets, RoleLimits(max_goalkeepers=2))
        assert len(result) == 2
        assert all(d.class_name == "goalkeeper" for d in result)
        # highest confidence kept
        assert result[0].confidence == 0.95
        assert result[1].confidence == 0.85

    def test_excess_referees_pruned(self) -> None:
        dets = [
            _det(1, "referee", 0.9),
            _det(2, "referee", 0.8),
            _det(3, "referee", 0.5),  # should be pruned
        ]
        result = filter_by_role(dets, RoleLimits(max_referees=2))
        assert len(result) == 2

    def test_excess_field_players_pruned(self) -> None:
        dets = [_det(i, "player", 0.9 - i * 0.01) for i in range(15)]
        result = filter_by_role(dets, RoleLimits(max_field_players=12))
        assert len(result) == 12
        # All kept detections should have higher confidence than dropped ones
        kept_confs = [d.confidence for d in result]
        assert kept_confs == sorted(kept_confs, reverse=True)

    def test_unknown_class_no_cap(self) -> None:
        dets = [_det(i, "unknown", 0.5) for i in range(10)]
        result = filter_by_role(dets, RoleLimits())
        assert len(result) == 10

    def test_mixed_classes(self) -> None:
        """Realistic frame: multiple classes, some over limit."""
        dets = [
            _det(1, "goalkeeper", 0.95),
            _det(2, "goalkeeper", 0.90),
            _det(3, "goalkeeper", 0.50),  # excess → pruned
            _det(4, "player", 0.93),
            _det(5, "player", 0.88),
            _det(6, "referee", 0.85),
            _det(7, "referee", 0.80),
            _det(8, "referee", 0.40),  # excess → pruned
            _det(9, "unknown", 0.30),
        ]
        result = filter_by_role(dets, RoleLimits())
        assert len(result) == 7
        classes = [d.class_name for d in result]
        assert classes.count("goalkeeper") == 2
        assert classes.count("referee") == 2
        assert classes.count("player") == 2
        assert classes.count("unknown") == 1

    def test_empty_input(self) -> None:
        assert filter_by_role([], RoleLimits()) == []

    def test_output_sorted_by_confidence(self) -> None:
        dets = [
            _det(1, "player", 0.5),
            _det(2, "goalkeeper", 0.9),
            _det(3, "referee", 0.7),
        ]
        result = filter_by_role(dets, RoleLimits())
        confs = [d.confidence for d in result]
        assert confs == sorted(confs, reverse=True)

    def test_custom_limits(self) -> None:
        """Verify that custom limits override defaults."""
        limits = RoleLimits(max_goalkeepers=1, max_referees=1, max_field_players=6)
        dets = [
            _det(1, "goalkeeper", 0.9),
            _det(2, "goalkeeper", 0.8),
            _det(3, "referee", 0.9),
            _det(4, "referee", 0.8),
        ]
        result = filter_by_role(dets, limits)
        assert len(result) == 2
        assert result[0].class_name == "goalkeeper"
        assert result[1].class_name == "referee"
