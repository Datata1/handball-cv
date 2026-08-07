"""
Team classifier — HDBSCAN + UMAP jersey-colour clustering.

Ported from CV-POC-HDBScan/src/clustering.py and feature_extractor.py.

Usage (same interface as the previous K-Means stub):

    classifier = TeamClassifier(n_teams=2)

    # Warm-up: collect samples from the first N frames
    for frame, detections in warmup_frames:
        classifier.collect_players(frame, [det.bbox for det in detections])

    classifier.fit()   # runs HDBSCAN on all collected features

    # Classification: one call per frame for all players — the expensive
    # full-frame preprocessing (white balance + CLAHE) runs once per frame,
    # not once per player.
    teams = classifier.classify_players(frame, [det.bbox for det in detections])

Algorithm
---------
1. collect() crops the torso region of each player and extracts a
   21-dimensional feature vector (19 colour + 2 normalised position).
2. fit() passes all collected features to ClusteringEngine which
   - StandardScaler-normalises the 19 colour dims
   - reduces to 10D with UMAP (if umap-learn is installed)
   - clusters with HDBSCAN (sklearn >= 1.4)
   - assigns roles: two largest clusters → Team A / B,
     goal-zone clusters → Torwart, remaining → Schiedsrichter
3. classify() extracts features from the new bbox, scales the colour
   dims, and assigns the nearest cluster centroid's role.
"""

from __future__ import annotations

import logging

import numpy as np

from ingestion.pipeline.clustering import ClusteringEngine, ClusterResult
from ingestion.pipeline.feature_extractor import FeatureExtractor
from ingestion.pipeline.utils.color_correction import apply_clahe, correct_white_balance
from ingestion.types import BoundingBox

logger = logging.getLogger(__name__)

AVAILABLE: bool = True  # scikit-learn and opencv are core deps

_UNKNOWN = "unknown"


class TeamClassifier:
    def __init__(self, n_teams: int = 2) -> None:
        self._n_teams = n_teams
        self._fitted = False
        self._extractor = FeatureExtractor(torso_top=0.15, torso_bottom=0.60)
        self._engine = ClusteringEngine(min_cluster_size=50, min_samples=5, kmeans_k=5)
        self._samples: list[np.ndarray] = []

        # Populated in fit()
        self._hdb_result: ClusterResult | None = None
        # Centroids in scaled 19-dim colour space — used for nearest-centroid classify()
        self._color_centroids: np.ndarray | None = None  # (n_clusters, 19)
        self._centroid_labels: list[int] = []
        self._label_to_team: dict[int, str] = {}

    @property
    def is_fitted(self) -> bool:
        return self._fitted

    def collect(self, frame: np.ndarray, bbox: BoundingBox) -> None:
        """Extract a jersey-colour feature vector for one player and accumulate it.

        Prefer collect_players() when the frame has several detections — it
        preprocesses the frame only once.
        """
        self.collect_players(frame, [bbox])

    def collect_players(self, frame: np.ndarray, bboxes: list[BoundingBox]) -> None:
        """Extract and accumulate feature vectors for all players of one frame.

        Call once per frame during the warm-up phase.
        """
        if not bboxes:
            return
        pre = _preprocess(frame)
        h, w = pre.shape[:2]
        for bbox in bboxes:
            feat = self._extractor.extract(
                pre,
                (bbox.x1, bbox.y1, bbox.x2, bbox.y2),
                frame_w=w,
                frame_h=h,
            )
            if feat is not None:
                self._samples.append(feat)

    def fit(self) -> None:
        """Cluster all accumulated samples with HDBSCAN.

        Raises RuntimeError if fewer than 2 * n_teams samples were collected.
        """
        if len(self._samples) < 2 * self._n_teams:
            raise RuntimeError(
                f"TeamClassifier needs at least {2 * self._n_teams} samples, "
                f"got {len(self._samples)}"
            )

        features = np.stack(self._samples)  # (N, 21)
        hdb, _ = self._engine.fit(features, raw_features=features)
        self._hdb_result = hdb

        # Build centroids in scaled 19-dim colour space.
        # HDBSCAN ran on exactly these dims, so nearest-centroid in this space
        # is consistent with the clustering decision boundary.
        color_scaled = self._engine._features_scaled[:, :19]
        unique_labels = sorted(lbl for lbl in set(hdb.labels) if lbl != -1)
        self._centroid_labels = unique_labels
        self._color_centroids = np.array(
            [color_scaled[hdb.labels == lbl].mean(axis=0) for lbl in unique_labels]
        )  # (n_clusters, 19)

        # Map HDBSCAN role strings to the "A" / "B" / "unknown" strings
        # expected by the orchestrator and the DuckDB schema.
        self._label_to_team = {}
        for lbl in unique_labels:
            role = hdb.role_map.get(lbl, _UNKNOWN)
            if role == "Team A":
                self._label_to_team[lbl] = "A"
            elif role == "Team B":
                self._label_to_team[lbl] = "B"
            else:
                # Torwart and Schiedsrichter are not a "team" in the schema
                self._label_to_team[lbl] = _UNKNOWN

        logger.info(
            "TeamClassifier fitted: %d clusters, jersey colours: %s",
            hdb.n_clusters,
            hdb.team_colors,
        )
        self._fitted = True

    def classify(self, frame: np.ndarray, bbox: BoundingBox) -> str:
        """Classify one player as 'A', 'B', or 'unknown'.

        Prefer classify_players() when the frame has several detections — it
        preprocesses the frame only once.
        """
        return self.classify_players(frame, [bbox])[0]

    def classify_players(self, frame: np.ndarray, bboxes: list[BoundingBox]) -> list[str]:
        """Classify all players of one frame as 'A', 'B', or 'unknown'.

        Uses nearest-centroid assignment in the fitted scaled colour space.
        Returns 'unknown' entries if the classifier has not been fitted yet.
        The expensive full-frame preprocessing runs once per call, so this is
        ~len(bboxes)x cheaper than calling classify() per player.
        """
        if not bboxes:
            return []
        if not self._fitted or self._color_centroids is None:
            return [_UNKNOWN] * len(bboxes)

        pre = _preprocess(frame)
        h, w = pre.shape[:2]
        teams: list[str] = []
        for bbox in bboxes:
            feat = self._extractor.extract(
                pre,
                (bbox.x1, bbox.y1, bbox.x2, bbox.y2),
                frame_w=w,
                frame_h=h,
            )
            if feat is None:
                teams.append(_UNKNOWN)
                continue

            # Scale the 19 colour features with the fitted StandardScaler
            color_feat = feat[:19].reshape(1, -1)
            color_scaled = self._engine._scaler.transform(color_feat)[0]

            # Nearest centroid in scaled colour space → cluster label → team string
            dists = np.linalg.norm(self._color_centroids - color_scaled, axis=1)
            nearest_lbl = self._centroid_labels[int(np.argmin(dists))]
            teams.append(self._label_to_team.get(nearest_lbl, _UNKNOWN))

        return teams


def _preprocess(frame: np.ndarray) -> np.ndarray:
    """Gray-World white balance + CLAHE — same corrections as CV-POC-HDBScan."""
    frame = correct_white_balance(frame)
    return apply_clahe(frame)
