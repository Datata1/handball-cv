"""
Court mapper — pixel coordinates → real-world court coordinates.

Uses a homography matrix (3x3) estimated from court keypoints detected by
YOLO-Pose.  The homography maps image-plane pixel positions to the real-world
court plane (40 m x 20 m).

Two construction paths:
  1. ``CourtMapper.from_file(path)`` — load a pre-computed calibration JSON
     (``{"src": [...], "dst": [...]}``).
  2. ``CourtMapper.from_keypoints(predicted, court_ref)`` — estimate the
     homography on the fly from auto-detected keypoints.

``transform()`` returns ``None`` when the projected point falls outside
the valid court area so the orchestrator can set ``court_pos = None`` cleanly.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import cv2
import numpy as np

from ingestion.pipeline.court_reference import COURT_LENGTH, COURT_WIDTH

AVAILABLE: bool = True  # opencv is a core dep

logger = logging.getLogger(__name__)

# Tolerance (metres) for accepting projected points that lie slightly outside
# the court rectangle — cameras sometimes produce borderline values.
_BOUNDARY_TOLERANCE: float = 2.0


def _collect_correspondences(
    predicted_points: list[tuple[float, float] | None],
    court_reference: dict[int, tuple[float, float]],
) -> tuple[np.ndarray, np.ndarray]:  # type: ignore[type-arg]
    """Pair detected image points with their known court coordinates."""
    src: list[list[float]] = []
    dst: list[list[float]] = []
    for i, point in enumerate(predicted_points):
        if point is None:
            continue
        if i not in court_reference:
            continue
        src.append([point[0], point[1]])
        dst.append(list(court_reference[i]))
    return np.array(src, dtype=np.float32), np.array(dst, dtype=np.float32)


def estimate_homography(
    predicted_points: list[tuple[float, float] | None],
    court_reference: dict[int, tuple[float, float]],
    ransac_reproj_threshold: float = 3.0,
) -> dict[str, object]:
    """Estimate the homography matrix from detected keypoints.

    Returns a dict with keys:
      - ``H``: 3x3 numpy array or ``None``
      - ``mask``: RANSAC inlier mask or ``None``
      - ``num_points``: number of point pairs used
      - ``inlier_count``, ``inlier_ratio``
      - ``mean_reprojection_error``, ``median_reprojection_error``
    """
    src_points, dst_points = _collect_correspondences(predicted_points, court_reference)

    details: dict[str, object] = {
        "H": None,
        "mask": None,
        "num_points": len(src_points),
        "inlier_count": 0,
        "inlier_ratio": 0.0,
        "mean_reprojection_error": None,
        "median_reprojection_error": None,
    }

    if len(src_points) < 4:
        return details

    try:
        h_matrix, mask = cv2.findHomography(
            src_points,
            dst_points,
            method=cv2.RANSAC,
            ransacReprojThreshold=ransac_reproj_threshold,
        )
    except cv2.error:
        return details

    if h_matrix is None:
        return details

    details["H"] = h_matrix
    details["mask"] = mask

    # Compute reprojection statistics on inliers
    if mask is not None and len(mask) == len(src_points):
        mask_flat: np.ndarray = mask.astype(bool).reshape(-1)  # type: ignore[type-arg]
        inlier_count = int(np.sum(mask_flat))
        details["inlier_count"] = inlier_count
        details["inlier_ratio"] = inlier_count / float(len(src_points)) if len(src_points) else 0.0
        inlier_src = src_points[mask_flat]
        inlier_dst = dst_points[mask_flat]
    else:
        inlier_src = src_points
        inlier_dst = dst_points

    if len(inlier_src) > 0:
        projected: np.ndarray = cv2.perspectiveTransform(  # type: ignore[type-arg]
            inlier_src.reshape(-1, 1, 2), h_matrix
        ).reshape(-1, 2)
        errors: np.ndarray = np.linalg.norm(projected - inlier_dst, axis=1)  # type: ignore[type-arg]
        details["mean_reprojection_error"] = float(np.mean(errors))
        details["median_reprojection_error"] = float(np.median(errors))

    return details


class CourtMapper:
    """Homography-based pixel-to-court coordinate transformer."""

    _h_matrix: np.ndarray  # type: ignore[type-arg]

    def __init__(self, src_points: list[list[float]], dst_points: list[list[float]]) -> None:
        src = np.array(src_points, dtype=np.float32)
        dst = np.array(dst_points, dtype=np.float32)
        if len(src) < 4:
            msg = f"Need at least 4 point pairs, got {len(src)}"
            raise ValueError(msg)
        h_matrix, _ = cv2.findHomography(src, dst, method=cv2.RANSAC, ransacReprojThreshold=3.0)
        if h_matrix is None:
            msg = "cv2.findHomography returned None — points may be degenerate"
            raise ValueError(msg)
        self._h_matrix = h_matrix

    @classmethod
    def from_file(cls, path: Path) -> CourtMapper:
        """Load calibration from a JSON file produced by calibrate.py."""
        data = json.loads(path.read_text())
        return cls(data["src"], data["dst"])

    @classmethod
    def from_matrix(cls, h_matrix: np.ndarray) -> CourtMapper:  # type: ignore[type-arg]
        """Create a CourtMapper directly from a pre-computed 3x3 homography matrix."""
        instance = object.__new__(cls)
        instance._h_matrix = h_matrix.astype(np.float64)
        return instance

    @classmethod
    def from_keypoints(
        cls,
        predicted_points: list[tuple[float, float] | None],
        court_reference: dict[int, tuple[float, float]],
        ransac_reproj_threshold: float = 3.0,
    ) -> CourtMapper | None:
        """Estimate homography from auto-detected court keypoints.

        Returns a ``CourtMapper`` on success, or ``None`` when fewer than 4
        keypoints were detected or RANSAC fails.
        """
        details = estimate_homography(predicted_points, court_reference, ransac_reproj_threshold)
        h_matrix = details["H"]
        if h_matrix is None:
            return None
        assert isinstance(h_matrix, np.ndarray)
        return cls.from_matrix(h_matrix)

    @property
    def homography(self) -> np.ndarray:  # type: ignore[type-arg]
        """The raw 3x3 homography matrix (image → court)."""
        return self._h_matrix

    def transform(self, pixel_pos: tuple[float, float]) -> tuple[float, float] | None:
        """Map a pixel coordinate to court coordinates (metres).

        Returns ``None`` if the transformed point falls outside the valid court
        boundaries (with a small tolerance), which happens when the camera is
        zoomed in on a region that cannot be reliably mapped.
        """
        pt = np.array([[pixel_pos]], dtype=np.float32)
        projected: np.ndarray = cv2.perspectiveTransform(pt, self._h_matrix)  # type: ignore[type-arg]
        x, y = float(projected[0, 0, 0]), float(projected[0, 0, 1])

        if (
            -_BOUNDARY_TOLERANCE <= x <= COURT_LENGTH + _BOUNDARY_TOLERANCE
            and -_BOUNDARY_TOLERANCE <= y <= COURT_WIDTH + _BOUNDARY_TOLERANCE
        ):
            return (x, y)
        return None

    def transform_batch(
        self, pixel_positions: list[tuple[float, float]]
    ) -> list[tuple[float, float] | None]:
        """Map multiple pixel coordinates to court coordinates in one call."""
        if not pixel_positions:
            return []
        pts = np.array(pixel_positions, dtype=np.float32).reshape(-1, 1, 2)
        projected: np.ndarray = cv2.perspectiveTransform(pts, self._h_matrix).reshape(-1, 2)  # type: ignore[type-arg]
        results: list[tuple[float, float] | None] = []
        for x, y in projected:
            fx, fy = float(x), float(y)
            if (
                -_BOUNDARY_TOLERANCE <= fx <= COURT_LENGTH + _BOUNDARY_TOLERANCE
                and -_BOUNDARY_TOLERANCE <= fy <= COURT_WIDTH + _BOUNDARY_TOLERANCE
            ):
                results.append((fx, fy))
            else:
                results.append(None)
        return results
