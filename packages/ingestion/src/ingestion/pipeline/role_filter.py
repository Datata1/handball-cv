"""
Handball role-based post-processing filter.

Applies soft constraints based on handball rules: each frame should contain
at most a known number of players per role (e.g. 2 goalkeepers, 12 field
players, 2 referees). Excess detections of any role are dropped by lowest
confidence first.

This is a **soft** filter — it never raises errors, only prunes unlikely
detections. YOLO class labels are noisy, so hard constraints would break
the pipeline on frames with misclassifications.

The filter runs after PersonDetector and before team classification / court
mapping in the orchestrator.
"""

from __future__ import annotations

from dataclasses import dataclass

from ingestion.types import Detection


@dataclass(frozen=True)
class RoleLimits:
    """Maximum number of detections allowed per YOLO class label per frame."""

    max_goalkeepers: int = 2  # 1 per team
    max_referees: int = 2
    max_field_players: int = 12  # 6 per team


# Maps YOLO class_name → RoleLimits field name
_CLASS_TO_LIMIT: dict[str, str] = {
    "goalkeeper": "max_goalkeepers",
    "referee": "max_referees",
    "player": "max_field_players",
}


def filter_by_role(
    detections: list[Detection],
    limits: RoleLimits,
) -> list[Detection]:
    """Keep only the top-N detections per class by confidence.

    Detections whose ``class_name`` has no cap in *limits* (e.g. ``"unknown"``)
    are passed through unchanged.

    The returned list preserves the original ordering (confidence-descending)
    within each class.
    """
    by_class: dict[str, list[Detection]] = {}
    for det in detections:
        by_class.setdefault(det.class_name, []).append(det)

    result: list[Detection] = []
    for cls_name, dets in by_class.items():
        # Already sorted by confidence from PersonDetector, but ensure it
        dets.sort(key=lambda d: d.confidence, reverse=True)

        limit_attr = _CLASS_TO_LIMIT.get(cls_name)
        if limit_attr is not None:
            cap = getattr(limits, limit_attr)
            result.extend(dets[:cap])
        else:
            result.extend(dets)  # no cap for this class

    # Restore global confidence-descending order
    result.sort(key=lambda d: d.confidence, reverse=True)
    return result
