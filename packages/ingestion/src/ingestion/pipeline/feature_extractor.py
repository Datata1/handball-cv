"""
Jersey colour feature extraction.

Ported 1:1 from CV-POC-HDBScan/src/feature_extractor.py.

Pipeline per player bounding box
---------------------------------
1. Crop the torso region (skip head + legs).
2. Build a mask that removes ONLY skin-coloured pixels (hands, face peeking out).
   Dark pixels are NOT excluded — black referee jerseys must remain.
3. Compute a 19-dimensional feature vector:
   - 6 values : mean + std of each LAB channel (perceptually uniform colour space)
   - 3 values : white_frac, dark_frac, colorful_frac
   - 8 values : normalised HSV-hue histogram on colourful pixels (S > 60, 8 bins)
   - 2 values : mean HSV-V (brightness) and mean HSV-S (saturation)
4. Append 2 position features: normalised bbox-centre (x, y).
"""

from __future__ import annotations

import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# HSV ranges to exclude skin (conservative — avoids masking lightly coloured jerseys)
_SKIN_LO1 = np.array([0, 30, 60], dtype=np.uint8)
_SKIN_HI1 = np.array([18, 160, 255], dtype=np.uint8)
_SKIN_LO2 = np.array([170, 30, 60], dtype=np.uint8)  # hue wrap-around
_SKIN_HI2 = np.array([180, 160, 255], dtype=np.uint8)


class FeatureExtractor:
    FEATURE_DIM = 21  # 19 colour + 2 position (x_norm, y_norm)
    _N_COLOR = 19

    def __init__(self, torso_top: float = 0.15, torso_bottom: float = 0.60) -> None:
        self._top = torso_top
        self._bot = torso_bottom

    def extract(
        self, frame: np.ndarray, bbox: tuple, frame_w: int = 0, frame_h: int = 0
    ) -> np.ndarray | None:
        """Return 21-dim feature vector or None if ROI is unusable.

        bbox must be (x1, y1, x2, y2) in pixel coordinates.
        frame_w / frame_h are used to compute normalised centre position.
        Passing 0/0 inserts 0.5/0.5 (court centre) so clustering stays colour-dominated.
        """
        roi = self._torso_crop(frame, bbox)
        if roi is None:
            return None

        roi_small = cv2.resize(roi, (32, 32))
        hsv = cv2.cvtColor(roi_small, cv2.COLOR_BGR2HSV)
        mask = self._jersey_mask(hsv)

        # Fall back to full ROI if masking removes almost everything
        if int(np.sum(mask > 0)) < 25:
            mask = np.full((32, 32), 255, dtype=np.uint8)

        color_feats = self._compute_features(roi_small, hsv, mask)

        if frame_w > 0 and frame_h > 0:
            cx = ((bbox[0] + bbox[2]) / 2.0) / frame_w
            cy = ((bbox[1] + bbox[3]) / 2.0) / frame_h
        else:
            cx, cy = 0.5, 0.5
        pos_feats = np.array([float(cx), float(cy)], dtype=np.float32)

        return np.concatenate([color_feats, pos_feats])

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _torso_crop(self, frame: np.ndarray, bbox: tuple) -> np.ndarray | None:
        x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
        h = y2 - y1
        w = x2 - x1
        if h <= 0 or w <= 0:
            return None
        t1 = y1 + int(h * self._top)
        t2 = y1 + int(h * self._bot)
        if t2 - t1 < 8:
            return None
        # Narrow horizontally by 10% each side to reduce background bleed
        margin_x = max(1, int(w * 0.10))
        roi = frame[t1:t2, x1 + margin_x : x2 - margin_x]
        if roi.size == 0 or roi.shape[0] < 8 or roi.shape[1] < 8:
            roi = frame[t1:t2, x1:x2]
        if roi.size == 0 or roi.shape[0] < 8 or roi.shape[1] < 8:
            return None
        return roi.copy()

    @staticmethod
    def _jersey_mask(hsv: np.ndarray) -> np.ndarray:
        # Exclude ONLY skin pixels — dark pixels (referees) must remain!
        skin1 = cv2.inRange(hsv, _SKIN_LO1, _SKIN_HI1)
        skin2 = cv2.inRange(hsv, _SKIN_LO2, _SKIN_HI2)
        skin = cv2.bitwise_or(skin1, skin2)
        return cv2.bitwise_not(skin)

    @staticmethod
    def _compute_features(roi: np.ndarray, hsv: np.ndarray, mask: np.ndarray) -> np.ndarray:
        features: list = []
        mask_bool = mask > 0
        n_pixels = max(1, int(mask_bool.sum()))

        # --- 6 values: LAB mean + std on all non-skin pixels ---
        lab = cv2.cvtColor(roi, cv2.COLOR_BGR2LAB)
        for c in range(3):
            pixels = lab[:, :, c][mask_bool].astype(np.float32)
            if len(pixels) > 0:
                features.extend([float(pixels.mean()), float(pixels.std())])
            else:
                features.extend([0.0, 0.0])

        # --- 3 values: explicit colour-type fractions ---
        v_ch = hsv[:, :, 2][mask_bool].astype(np.float32)
        s_ch = hsv[:, :, 1][mask_bool].astype(np.float32)

        white_frac = float(np.sum((v_ch > 170) & (s_ch < 50))) / n_pixels
        dark_frac = float(np.sum(v_ch < 80)) / n_pixels
        colorful_frac = float(np.sum(s_ch > 60)) / n_pixels
        features.extend([white_frac, dark_frac, colorful_frac])

        # --- 8 values: HSV hue histogram on colourful pixels (S > 60) ---
        colorful_mask = mask_bool & (hsv[:, :, 1] > 60)
        hue_pixels = hsv[:, :, 0][colorful_mask]
        if len(hue_pixels) >= 5:
            hist, _ = np.histogram(hue_pixels, bins=8, range=(0, 180))
            hist = hist.astype(np.float32) / (hist.sum() + 1e-8)
        else:
            hist = np.zeros(8, dtype=np.float32)
        features.extend(hist.tolist())

        # --- 2 values: mean V and S on all non-skin pixels ---
        mean_v = float(v_ch.mean()) / 255.0 if len(v_ch) > 0 else 0.0
        mean_s = float(s_ch.mean()) / 255.0 if len(s_ch) > 0 else 0.0
        features.extend([mean_v, mean_s])

        return np.array(features, dtype=np.float32)
