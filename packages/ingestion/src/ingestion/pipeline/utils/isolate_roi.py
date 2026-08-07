import cv2
import numpy as np

"""ROI-Erkennung und Zuschnitt fuer Hallen-Videos.

Dieses Modul arbeitet in zwei Schritten:
1) ROI-Schaetzung: Aus mehreren Frames wird eine stabile vertikale ROI berechnet.
2) Zuschnitt: Das Video wird auf diese ROI zugeschnitten gespeichert.

Typischer Aufruf:
    roi, roi_stats = isolate_roi("input.mp4", "cropped.mp4")

Nur ROI berechnen (ohne Schreiben):
    stable_roi, stats = get_stable_roi("input.mp4", num_samples=100)
"""


def _sample_regions(img_h):
    """Liefert die vertikalen Sample-Regionen für die Farbstatistik."""
    return [
        (int(img_h * 0.4), int(img_h * 0.55)),
        (int(img_h * 0.55), int(img_h * 0.7)),
        (int(img_h * 0.7), int(img_h * 0.85)),
    ]


def _collect_hsv_samples(hsv):
    """Sammelt H/S/V-Werte aus den relevanten Sample-Regionen."""
    img_h, img_w = hsv.shape[:2]
    h_values = []
    s_values = []
    v_values = []

    for y_start, y_end in _sample_regions(img_h):
        sample_region = hsv[y_start:y_end, int(img_w * 0.3) : int(img_w * 0.7)]
        if sample_region.size > 0:
            h_values.extend(sample_region[:, :, 0].flatten())
            s_values.extend(sample_region[:, :, 1].flatten())
            v_values.extend(sample_region[:, :, 2].flatten())

    return h_values, s_values, v_values


def _compute_hsv_reference(h_values, s_values, v_values):
    """Berechnet die robusten HSV-Referenzwerte."""
    return (
        int(np.percentile(h_values, 50)),
        int(np.percentile(s_values, 50)),
        int(np.percentile(v_values, 50)),
    )


def _build_court_mask(hsv, median_h, median_s, median_v):
    """Erzeugt die Spielfeld-Maske aus den HSV-Referenzwerten."""
    lower = np.array([max(0, median_h - 15), max(0, median_s - 50), max(0, median_v - 50)])
    upper = np.array([min(179, median_h + 15), min(255, median_s + 50), min(255, median_v + 50)])

    court_mask = cv2.inRange(hsv, lower, upper)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    court_mask = cv2.morphologyEx(court_mask, cv2.MORPH_CLOSE, kernel)
    court_mask = cv2.morphologyEx(court_mask, cv2.MORPH_OPEN, kernel)
    return court_mask


def _largest_contour_bbox(court_mask):
    """Liefert Bounding Box und Konturfläche der größten Kontur."""
    contours, _ = cv2.findContours(court_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None, 0.0

    largest_contour = max(contours, key=lambda c: cv2.contourArea(c))
    x, y, w, h = cv2.boundingRect(largest_contour)
    contour_area = cv2.contourArea(largest_contour)
    return (x, y, w, h), contour_area


def _compute_confidence(court_mask, contour_area, frame_area):
    """Berechnet den ROI-Confidence-Score."""
    mask_pixels = cv2.countNonZero(court_mask)
    mask_coverage = mask_pixels / frame_area
    contour_ratio = contour_area / frame_area
    return float(np.sqrt(mask_coverage * contour_ratio))


def _collect_roi_samples(input_path, num_samples):
    """Sammelt ROI-Ränder und Konfidenzen über mehrere Frames."""
    cap = cv2.VideoCapture(input_path)
    frame_count_total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    sample_interval = max(1, frame_count_total // num_samples)
    y_tops = []
    y_bottoms = []
    confidence_scores = []

    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % sample_interval == 0:
            roi, _, confidence = detect_court_roi(frame)
            _, y, _, h = roi
            y_tops.append(y)
            y_bottoms.append(y + h)
            confidence_scores.append(confidence)

        frame_count += 1

    cap.release()
    return width, height, y_tops, y_bottoms, confidence_scores


def _build_stable_vertical_roi(width, height, y_tops, y_bottoms):
    """Berechnet eine stabile vertikale ROI aus den Sample-Rändern."""
    stable_y_top = int(np.median(y_tops))
    top_padding = int(height * 0.1)
    stable_y_top = max(0, stable_y_top - top_padding)

    stable_y_bottom = int(np.percentile(y_bottoms, 90))
    bottom_padding = 15
    stable_y_bottom = min(height, stable_y_bottom + bottom_padding)

    stable_roi = (0, stable_y_top, width, stable_y_bottom - stable_y_top)
    return stable_roi, stable_y_top, stable_y_bottom


def _build_roi_stats(confidence_scores, stable_y_top, stable_y_bottom, height):
    """Baut das Statistik-Dict für die stabile ROI."""
    conf_mean = np.mean(confidence_scores)
    conf_min = np.min(confidence_scores)
    conf_max = np.max(confidence_scores)
    conf_std = np.std(confidence_scores)

    quality_flag = "OK"
    warnings = []

    if conf_mean < 0.15:
        quality_flag = "WARN_LOW_CONFIDENCE"
        warnings.append(
            f"⚠️ NIEDRIGE KONFIDENZ (Ø {conf_mean:.3f}): ROI möglicherweise zu stark abgeschnitten"
        )
    elif conf_mean > 0.8:
        quality_flag = "WARN_HIGH_CONFIDENCE"
        warnings.append(
            f"⚠️ HOHE KONFIDENZ (Ø {conf_mean:.3f}): Möglicherweise Spieler/Publikum drin"
        )

    if conf_std > 0.15:
        warnings.append(f"⚠️ INSTABIL (Std {conf_std:.3f}): ROI-Schätzung schwankt zwischen Frames")

    if conf_min < 0.05:
        warnings.append(
            f"⚠️ AUSREISSER: Einige Frames haben sehr niedrige Konfidenz ({conf_min:.3f})"
        )

    top_cut_percent = (stable_y_top / height) * 100
    bottom_cut_percent = ((height - stable_y_bottom) / height) * 100

    return {
        "confidence_mean": float(conf_mean),
        "confidence_min": float(conf_min),
        "confidence_max": float(conf_max),
        "confidence_std": float(conf_std),
        "quality_flag": quality_flag,
        "warnings": warnings,
        "top_cut_percent": float(top_cut_percent),
        "bottom_cut_percent": float(bottom_cut_percent),
    }


def detect_court_roi(frame):
    """
    Erkennt das Spielfeld automatisch anhand der Bodenfarbe.
    Optimiert für Kamera-Position: mittig an der unteren Bande.

    Returns:
        tuple: (roi, court_mask, confidence_score)
               confidence_score: 0.0 - 1.0 (höher = bessere Erkennung)

    Aufruf:
        roi, mask, confidence = detect_court_roi(frame)
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    img_h, img_w = frame.shape[:2]
    frame_area = img_h * img_w

    h_values, s_values, v_values = _collect_hsv_samples(hsv)
    median_h, median_s, median_v = _compute_hsv_reference(h_values, s_values, v_values)
    court_mask = _build_court_mask(hsv, median_h, median_s, median_v)

    roi, contour_area = _largest_contour_bbox(court_mask)
    if roi is None:
        return (0, 0, img_w, img_h), court_mask, 0.0

    confidence = _compute_confidence(court_mask, contour_area, frame_area)
    return roi, court_mask, confidence


def get_stable_roi(input_path, num_samples=100):
    """
    Berechnet eine stabile ROI über mehrere Frames.

    Angepasst für Kamera unten mittig:
    - Oben wird mehr abgeschnitten (Tribüne, Wand)
    - Unten wird wenig/nichts abgeschnitten (Kamera ist nah)
    - X = volle Breite (Kamera schwenkt horizontal)

    Returns:
        tuple: (stable_roi, roi_stats_dict)

    Aufruf:
        stable_roi, roi_stats = get_stable_roi("input.mp4", num_samples=120)
    """
    width, height, y_tops, y_bottoms, confidence_scores = _collect_roi_samples(
        input_path, num_samples
    )

    if not y_tops:
        return (0, 0, width, height), {
            "confidence_mean": 0.0,
            "confidence_min": 0.0,
            "confidence_max": 0.0,
            "quality_flag": "FAIL_NO_DETECTION",
        }

    stable_roi, stable_y_top, stable_y_bottom = _build_stable_vertical_roi(
        width, height, y_tops, y_bottoms
    )
    roi_stats = _build_roi_stats(confidence_scores, stable_y_top, stable_y_bottom, height)

    return stable_roi, roi_stats


def apply_roi_to_video(input_path, output_path, roi):
    """Schneidet das Video auf die ROI zu.

    Args:
        input_path: Pfad zum Input-Video.
        output_path: Pfad fuer das zugeschnittene Output-Video.
        roi: Tuple (x, y, w, h), typischerweise aus get_stable_roi().

    Aufruf:
        roi, _ = get_stable_roi("input.mp4")
        apply_roi_to_video("input.mp4", "cropped.mp4", roi)
    """
    cap = cv2.VideoCapture(input_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    # total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    x, y, w, h = roi
    w = w - (w % 2)
    h = h - (h % 2)

    fourcc = cv2.VideoWriter.fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (w, h))

    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        cropped = frame[y : y + h, x : x + w]
        out.write(cropped)
        frame_count += 1

    cap.release()
    out.release()


def isolate_roi(input_path, output_path):
    """Orchestriert ROI-Schaetzung und Video-Zuschnitt.

    Returns:
        tuple: (roi, roi_stats)

    Aufruf:
        roi, roi_stats = isolate_roi("input.mp4", "cropped.mp4")
    """
    roi, roi_stats = get_stable_roi(input_path)

    apply_roi_to_video(input_path, output_path, roi)

    return roi, roi_stats
