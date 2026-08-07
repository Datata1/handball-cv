"""
Clustering engine: HDBSCAN (primary) + K-Means (comparison).

Ported 1:1 from CV-POC-HDBScan/src/clustering.py.

Design decisions
----------------
- Features are StandardScaler-normalised before clustering.
- UMAP reduces the 19-dim feature space to 10D before HDBSCAN (if umap-learn is installed).
- HDBSCAN runs with cluster_selection_epsilon = 0 (sklearn 1.8.0 bug with > 0).
- Noise points are assigned to the nearest centroid in UMAP space.
- Role assignment is colour-aware (no YOLO class labels):
    1. Two LARGEST clusters        → Team A, Team B
    2. Position-based clusters     → Torwart (near goal, low lateral variance)
    3. All remaining clusters      → Schiedsrichter
"""

from __future__ import annotations

import logging

import numpy as np
from sklearn.cluster import HDBSCAN, KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import pairwise_distances, silhouette_score
from sklearn.preprocessing import StandardScaler

try:
    from umap import UMAP

    _UMAP_AVAILABLE = True
except ImportError:
    _UMAP_AVAILABLE = False

logger = logging.getLogger(__name__)

# Feature indices (must match feature_extractor.py)
_IDX_WHITE = 6  # white_frac
_IDX_DARK = 7  # dark_frac
_IDX_COLORFUL = 8  # colorful_frac
_IDX_HUE_START = 9  # first of 8 hue-histogram bins (OpenCV hue 0-180)
_IDX_MEAN_V = 17  # mean HSV brightness
_IDX_POS_X = 19  # normalised bbox-centre x  (0 = left, 1 = right)
_IDX_POS_Y = 20  # normalised bbox-centre y  (0 = top,  1 = bottom)

_HUE_NAMES = ["Rot", "Orange-Rot", "Orange", "Gelb", "Grün", "Türkis", "Blau", "Lila"]

_ROLE_NAMES = ["Team A", "Team B", "Schiedsrichter", "Torwart", "Torwart", "Torwart"]


def _infer_jersey_color(centroid: np.ndarray) -> str:
    """Return a human-readable German colour name for a cluster centroid."""
    white_frac = float(centroid[_IDX_WHITE])
    dark_frac = float(centroid[_IDX_DARK])
    colorful = float(centroid[_IDX_COLORFUL])

    if white_frac > 0.45:
        return "Weiß"
    if dark_frac > 0.50 and colorful < 0.20:
        return "Dunkel"
    if colorful < 0.15:
        return "Grau"

    hue_hist = centroid[_IDX_HUE_START : _IDX_HUE_START + 8]
    return _HUE_NAMES[int(np.argmax(hue_hist))]


def _is_orange_jersey(centroid: np.ndarray) -> bool:
    """Return True if centroid matches an orange jersey (handball referees).

    Orange in OpenCV HSV (0-180 scale) sits at roughly hue 10-30 deg, which falls
    into hue bins 0 (0-22.5 deg) and 1 (22.5-45 deg) of the 8-bin histogram.
    """
    white_frac = float(centroid[_IDX_WHITE])
    dark_frac = float(centroid[_IDX_DARK])
    colorful = float(centroid[_IDX_COLORFUL])
    hue_hist = centroid[_IDX_HUE_START : _IDX_HUE_START + 8]
    dominant = int(np.argmax(hue_hist))
    return colorful > 0.20 and white_frac < 0.40 and dark_frac < 0.40 and dominant <= 2


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------


class ClusterResult:
    def __init__(
        self,
        labels: np.ndarray,
        probabilities: np.ndarray,
        method: str,
        n_clusters: int,
        n_noise: int,
        silhouette: float | None = None,
        n_reassigned: int = 0,
    ):
        self.labels = labels
        self.probabilities = probabilities
        self.method = method
        self.n_clusters = n_clusters
        self.n_noise = n_noise
        self.n_reassigned = n_reassigned
        self.silhouette = silhouette
        self.role_map: dict[int, str] = {}
        self.team_colors: dict[str, str] = {}

    def map_roles(self) -> dict[int, str]:
        """Fallback: assign roles by descending cluster size."""
        unique = sorted(lbl for lbl in set(self.labels) if lbl != -1)
        counts = {lbl: int(np.sum(self.labels == lbl)) for lbl in unique}
        sorted_pairs = sorted(counts.items(), key=lambda x: x[1], reverse=True)
        self.role_map = {-1: "Noise / Unklar"}
        for i, (lbl, _) in enumerate(sorted_pairs):
            self.role_map[lbl] = _ROLE_NAMES[i] if i < len(_ROLE_NAMES) else f"Cluster {lbl}"
        return self.role_map

    def map_roles_smart(self, raw_features: np.ndarray) -> dict[int, str]:
        """
        Position + colour based role assignment.

        Order:
          1. Team A, Team B  — the two largest clusters
          2. Torwart         — remaining clusters near a goal (position-based),
                               at most one per goal side
          3. Schiedsrichter  — all remaining clusters
        """
        unique: list[int] = sorted(lbl for lbl in set(self.labels) if lbl != -1)
        self.role_map = {-1: "Noise / Unklar"}
        self.team_colors = {}

        if not unique:
            return self.role_map

        if raw_features.shape[1] <= max(_IDX_DARK, _IDX_COLORFUL):
            return self.map_roles()

        centroids = {lbl: raw_features[self.labels == lbl].mean(axis=0) for lbl in unique}
        counts = {lbl: int(np.sum(self.labels == lbl)) for lbl in unique}
        by_size = sorted(unique, key=lambda lbl: counts[lbl], reverse=True)
        remaining = list(by_size)

        has_pos = raw_features.shape[1] > _IDX_POS_X
        logger.info("=== HDBSCAN: %d Cluster gefunden ===", len(unique))
        for lbl in by_size:
            c = centroids[lbl]
            if has_pos:
                xs = raw_features[self.labels == lbl, _IDX_POS_X]
                mean_x = float(xs.mean())
                std_x = float(xs.std())
            else:
                mean_x = std_x = float("nan")
            logger.info(
                "  Cluster %2d | n=%4d | Farbe=%-12s | colorful=%.2f"
                " | white=%.2f | dark=%.2f | mean_x=%.2f | std_x=%.2f",
                lbl,
                counts[lbl],
                _infer_jersey_color(c),
                float(c[_IDX_COLORFUL]),
                float(c[_IDX_WHITE]),
                float(c[_IDX_DARK]),
                mean_x,
                std_x,
            )

        # ── Step 1: Teams — two largest clusters ─────────────────────────
        for team_name in ("Team A", "Team B"):
            if not remaining:
                break
            lbl = remaining.pop(0)
            color = _infer_jersey_color(centroids[lbl])
            self.role_map[lbl] = team_name
            self.team_colors[team_name] = color
            logger.info("%s (%s) <- Cluster %d  n=%d", team_name, color, lbl, counts[lbl])

        # ── Step 2: Torwart — position-based, one per goal side ──────────
        gk_zone = 0.15
        gk_std_max = 0.12
        total_n = sum(counts[lbl] for lbl in unique)

        gk_left: list[tuple] = []
        gk_right: list[tuple] = []

        if has_pos:
            for lbl in list(remaining):
                xs = raw_features[self.labels == lbl, _IDX_POS_X]
                mean_x = float(xs.mean())
                std_x = float(xs.std())
                if std_x > gk_std_max or counts[lbl] > total_n * 0.15:
                    continue
                if mean_x <= gk_zone:
                    gk_left.append((counts[lbl], lbl))
                elif mean_x >= 1.0 - gk_zone:
                    gk_right.append((counts[lbl], lbl))

        for side in (gk_left, gk_right):
            if side:
                _, best_lbl = max(side)
                remaining.remove(best_lbl)
                self.role_map[best_lbl] = "Torwart"
                xs = raw_features[self.labels == best_lbl, _IDX_POS_X]
                logger.info(
                    "Torwart (Position) <- Cluster %d  n=%d  mean_x=%.2f  std_x=%.2f",
                    best_lbl,
                    counts[best_lbl],
                    float(xs.mean()),
                    float(xs.std()),
                )

        # ── Step 3: Schiedsrichter — all remaining clusters ───────────────
        for lbl in remaining:
            self.role_map[lbl] = "Schiedsrichter"
            logger.info("Schiedsrichter <- Cluster %d  n=%d", lbl, counts[lbl])

        logger.info("Rollenzuweisung: %s", self.role_map)
        logger.info("Trikotfarben:    %s", self.team_colors)
        return self.role_map

    def get_role(self, label: int) -> str:
        return self.role_map.get(label, f"Cluster {label}")


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------


class ClusteringEngine:
    def __init__(self, min_cluster_size: int = 50, min_samples: int = 5, kmeans_k: int = 5) -> None:
        self._min_cluster_size = min_cluster_size
        self._min_samples = min_samples
        self._kmeans_k = kmeans_k
        self._scaler = StandardScaler()
        self._features_scaled: np.ndarray | None = None
        self._umap_2d: np.ndarray | None = None

    def fit(
        self,
        features: np.ndarray,
        raw_features: np.ndarray | None = None,
    ) -> tuple[ClusterResult, ClusterResult | None]:
        _raw = raw_features if raw_features is not None else features
        logger.info("Clustering von %d Feature-Vektoren …", len(features))

        # Scale colour features (first 19) separately from position (last 2).
        # Position kept raw so its natural std (~0.25) gives ~25 % weight
        # relative to unit-scaled colour dims.
        n_color = min(19, features.shape[1])
        color_scaled = self._scaler.fit_transform(features[:, :n_color])
        if features.shape[1] > n_color:
            self._features_scaled = np.concatenate([color_scaled, features[:, n_color:]], axis=1)
        else:
            self._features_scaled = color_scaled

        # UMAP 2D for visualisation (optional)
        if _UMAP_AVAILABLE:
            logger.info("UMAP 2D für Visualisierung …")
            umap_vis = UMAP(
                n_components=2,
                n_neighbors=min(30, max(5, len(features) // 20)),
                min_dist=0.3,
                random_state=42,
                metric="euclidean",
            )
            self._umap_2d = umap_vis.fit_transform(self._features_scaled)

        # Reduce min_cluster_size for tiny datasets only
        min_cs = min(self._min_cluster_size, max(2, len(features) // 4))
        if min_cs != self._min_cluster_size:
            logger.info(
                "min_cluster_size reduziert: %d → %d  (n=%d)",
                self._min_cluster_size,
                min_cs,
                len(features),
            )

        # HDBSCAN clusters on COLOUR features only (first 19 dims).
        # Excluding position prevents players at different field positions but
        # same jersey colour from splitting into separate clusters.
        n_color = min(19, self._features_scaled.shape[1])
        color_only = self._features_scaled[:, :n_color]

        hdb = self._fit_hdbscan(color_only, min_cs)
        hdb.map_roles_smart(_raw)

        km = self._fit_kmeans(self._features_scaled)
        if km:
            km.map_roles_smart(_raw)

        return hdb, km

    def get_2d_representation(self, features: np.ndarray) -> np.ndarray:
        if self._umap_2d is not None:
            return self._umap_2d
        scaled = (
            self._features_scaled
            if self._features_scaled is not None
            else self._scaler.transform(features)
        )
        return PCA(n_components=2, random_state=42).fit_transform(scaled)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _fit_hdbscan(self, scaled: np.ndarray, min_cs: int) -> ClusterResult:
        # ── UMAP 10D embedding ──────────────────────────────────────────
        if _UMAP_AVAILABLE and scaled.shape[0] >= 100:
            n_comp = min(10, scaled.shape[1])
            n_nb = max(15, min(100, scaled.shape[0] // 20))
            logger.info("UMAP %dD → %dD  n_neighbors=%d …", scaled.shape[1], n_comp, n_nb)
            reducer = UMAP(
                n_components=n_comp,
                n_neighbors=n_nb,
                min_dist=0.0,
                random_state=42,
                metric="euclidean",
            )
            umap_data = reducer.fit_transform(scaled)
            logger.info("UMAP fertig")
        else:
            umap_data = scaled

        # ── HDBSCAN ─────────────────────────────────────────────────────
        clusterer = HDBSCAN(
            min_cluster_size=min_cs,
            min_samples=self._min_samples,
            cluster_selection_epsilon=0.0,
            metric="euclidean",
            cluster_selection_method="eom",
            store_centers="centroid",
            copy=True,
        )
        labels = clusterer.fit_predict(umap_data)
        probs = clusterer.probabilities_.copy()

        unique_real = [lbl for lbl in set(labels) if lbl != -1]
        n_clusters = len(unique_real)
        n_noise_orig = int(np.sum(labels == -1))

        logger.info("HDBSCAN → %d Cluster, %d Noise (vor Neuzuweisung)", n_clusters, n_noise_orig)

        # ── Noise reassignment ──────────────────────────────────────────
        n_reassigned = 0
        if n_noise_orig > 0 and n_clusters >= 1:
            centroids = np.array([umap_data[labels == lbl].mean(axis=0) for lbl in unique_real])
            noise_idx = np.where(labels == -1)[0]
            dists = pairwise_distances(umap_data[noise_idx], centroids, metric="euclidean")
            nearest = np.argmin(dists, axis=1)

            labels = labels.copy()
            labels[noise_idx] = np.array(unique_real)[nearest]

            min_dists = dists[np.arange(len(noise_idx)), nearest]
            ref_radius = (
                np.array([umap_data[clusterer.labels_ == lbl].std() + 1e-8 for lbl in unique_real])[
                    nearest
                ]
                * 2
            )
            probs[noise_idx] = np.clip(1.0 - min_dists / ref_radius, 0.05, 1.0)

            n_reassigned = n_noise_orig
            logger.info("%d Noise-Punkte dem nächsten Cluster zugewiesen", n_reassigned)

        n_noise_final = int(np.sum(labels == -1))

        sil = None
        if n_clusters >= 2:
            try:
                non_noise = labels != -1
                sil = float(silhouette_score(umap_data[non_noise], labels[non_noise]))
            except Exception:
                pass

        tag = "UMAP+HDBSCAN" if _UMAP_AVAILABLE else "HDBSCAN"
        logger.info(
            "%s → %d Cluster, Silhouette=%s, %d neu zugewiesen",
            tag,
            n_clusters,
            f"{sil:.3f}" if sil is not None else "n/a",
            n_reassigned,
        )

        return ClusterResult(labels, probs, tag, n_clusters, n_noise_final, sil, n_reassigned)

    def _fit_kmeans(self, scaled: np.ndarray) -> ClusterResult | None:
        try:
            km = KMeans(n_clusters=self._kmeans_k, random_state=42, n_init=10)
            labels = km.fit_predict(scaled)
            sil = None
            if len(set(labels)) >= 2:
                sil = float(silhouette_score(scaled, labels))
            probs = np.ones(len(labels), dtype=np.float32)
            logger.info(
                "K-Means (k=%d) → Silhouette=%s",
                self._kmeans_k,
                f"{sil:.3f}" if sil is not None else "n/a",
            )
            return ClusterResult(
                labels, probs, f"K-Means (k={self._kmeans_k})", self._kmeans_k, 0, sil
            )
        except Exception as exc:
            logger.warning("K-Means fehlgeschlagen: %s", exc)
            return None
