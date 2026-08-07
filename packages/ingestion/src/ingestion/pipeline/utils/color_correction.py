import cv2
import numpy as np

"""Farb- und Belichtungskorrektur fuer Match-Videos.

Dieses Modul arbeitet in zwei Schritten:
1) Analyse: Sampling ueber das Video, um Kennzahlen (Helligkeit, Farbstich, Kontrast) zu sammeln.
2) Verarbeitung: Pro Frame nur die noetigen Korrekturen anwenden.

Typischer Aufruf in der Pipeline:
    color_correction(input_path="input.mp4", output_path="output.mp4")

Mit ROI (z. B. aus isolate_roi.py):
    color_correction(
        input_path="input.mp4",
        output_path="output.mp4",
        roi_bounds=(y_top, y_bottom),
    )
"""


def _extract_analysis_frame(frame, roi_bounds=None):
    """Liefert den Frame-Bereich für die Analyse (optional ROI)."""
    if roi_bounds is None:
        return frame

    y_top, y_bottom = roi_bounds
    return frame[y_top:y_bottom, :]


def _compute_frame_metrics(analysis_frame):
    """Berechnet Helligkeit, Kontrast, Farbstich und Ungleichmäßigkeit für einen Frame."""
    hsv = cv2.cvtColor(analysis_frame, cv2.COLOR_BGR2HSV)
    v = hsv[:, :, 2]

    brightness = float(v.mean())
    contrast = float(v.std())

    lab = cv2.cvtColor(analysis_frame, cv2.COLOR_BGR2LAB)
    color_cast = (
        float(lab[:, :, 1].mean() - 128),
        float(lab[:, :, 2].mean() - 128),
    )

    left_brightness = float(v[:, : v.shape[1] // 2].mean())
    right_brightness = float(v[:, v.shape[1] // 2 :].mean())
    unevenness = abs(left_brightness - right_brightness)

    return brightness, contrast, color_cast, unevenness


def _build_analysis_report(
    total_frames, brightness_values, contrast_values, color_casts, local_brightness
):
    """Aggregiert die gesammelten Sample-Metriken in einen Report.

    Der Report enthaelt neben Mittelwerten auch Entscheidungsflags
    (z. B. needs_white_balance), die spaeter direkt die Verarbeitung steuern.
    """
    report = {
        "total_frames": total_frames,
        "samples": len(brightness_values),
    }

    brightness_std = np.std(brightness_values)
    report["brightness_mean"] = np.mean(brightness_values)
    report["brightness_std"] = brightness_std
    report["needs_flicker_fix"] = brightness_std > 3.0

    avg_cast_a = np.mean([c[0] for c in color_casts])
    avg_cast_b = np.mean([c[1] for c in color_casts])
    cast_strength = np.sqrt(avg_cast_a**2 + avg_cast_b**2)
    report["color_cast_strength"] = cast_strength
    report["color_cast_a"] = avg_cast_a
    report["color_cast_b"] = avg_cast_b
    report["needs_white_balance"] = cast_strength > 5.0

    avg_contrast = np.mean(contrast_values)
    report["contrast_mean"] = avg_contrast
    report["needs_clahe"] = avg_contrast < 40.0

    avg_unevenness = np.mean(local_brightness)
    report["unevenness"] = avg_unevenness
    report["needs_local_correction"] = avg_unevenness > 15.0

    return report


def _select_fixes(report):
    """Leitet aus dem Report ab, welche Korrekturen angewendet werden sollen.

    Die Rueckgabe ist eine geordnete Liste von Schritten, die in
    _apply_selected_fixes nacheinander ausgefuehrt wird.
    """
    fixes = []
    if report["needs_white_balance"]:
        fixes.append("white_balance")
    if report["needs_flicker_fix"]:
        fixes.append("flicker")
    if report["needs_clahe"]:
        fixes.append("clahe")
    return fixes


def _apply_selected_fixes(frame, fixes, report, roi_bounds, flicker_factor):
    """Wendet die ausgewaehlten Korrekturen auf genau einen Frame an.

    Reihenfolge ist wichtig:
    1) White Balance (globale Farbkorrektur)
    2) Flicker-Korrektur (zeitliche Helligkeitsstabilisierung)
    3) CLAHE (lokale Kontrastanhebung)
    """
    if "white_balance" in fixes:
        frame = correct_white_balance(frame, roi_bounds=roi_bounds)

    if "flicker" in fixes:
        frame, flicker_factor = correct_flicker_temporal(
            frame,
            target_brightness=report["brightness_mean"],
            prev_factor=flicker_factor,
            smoothing=0.7,
        )

    if "clahe" in fixes:
        frame = apply_clahe(frame)

    return frame, flicker_factor


def _open_video_writer(input_path, output_path):
    """Öffnet VideoCapture und VideoWriter für die Verarbeitung."""
    cap = cv2.VideoCapture(input_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    fourcc = cv2.VideoWriter.fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    return cap, out


def analyze_video(input_path, sample_interval=30, roi_bounds=None):
    """
    Analysiert das Video und gibt einen Bericht zurück,
    welche Beleuchtungsprobleme vorliegen.

    Args:
        input_path: Pfad zum Video
        sample_interval: Jeden N-ten Frame analysieren
        roi_bounds: Optional (y_top, y_bottom) um Weißabgleich nur auf ROI zu berechnen
                    Verhindert Überkorrektur durch dominante Trikotfarben/Publikum

    Returns:
        dict: Analysebericht mit Kennzahlen und Entscheidungsflags.

    Aufruf:
        report = analyze_video("input.mp4", sample_interval=30)
        report = analyze_video("input.mp4", roi_bounds=(120, 900))
    """
    cap = cv2.VideoCapture(input_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    brightness_values = []
    color_casts = []  # Abweichung von neutralem Grau
    contrast_values = []
    local_brightness = []  # Unterschied links vs. rechts

    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % sample_interval == 0:
            analysis_frame = _extract_analysis_frame(frame, roi_bounds)
            brightness, contrast, color_cast, unevenness = _compute_frame_metrics(analysis_frame)
            brightness_values.append(brightness)
            contrast_values.append(contrast)
            color_casts.append(color_cast)
            local_brightness.append(unevenness)

        frame_count += 1

    cap.release()
    return _build_analysis_report(
        total_frames,
        brightness_values,
        contrast_values,
        color_casts,
        local_brightness,
    )


def correct_white_balance(frame, roi_bounds=None):
    """
    Korrigiert Weißabgleich via Gray-World-Annahme.

    Args:
        frame: Input-Frame
        roi_bounds: Optional (y_top, y_bottom) um Überkorrektur durch
                    dominante Trikotfarben/Publikum zu vermeiden.
                    Wenn gesetzt, werden Kanäle nur auf ROI-Region berechnet,
                    aber auf ganzen Frame angewendet.
    """
    b, g, r = cv2.split(frame.astype(np.float32))

    # Wenn ROI vorhanden: Weißabgleich nur auf ROI-Region berechnen
    if roi_bounds is not None:
        y_top, y_bottom = roi_bounds
        avg_b = b[y_top:y_bottom].mean()
        avg_g = g[y_top:y_bottom].mean()
        avg_r = r[y_top:y_bottom].mean()
    else:
        avg_b, avg_g, avg_r = b.mean(), g.mean(), r.mean()

    avg_gray = (avg_b + avg_g + avg_r) / 3
    b = np.clip(b * (avg_gray / avg_b), 0, 255)
    g = np.clip(g * (avg_gray / avg_g), 0, 255)
    r = np.clip(r * (avg_gray / avg_r), 0, 255)
    return cv2.merge([b, g, r]).astype(np.uint8)


def correct_flicker(frame, target_brightness):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    current = v.mean()
    if current > 0:
        factor = np.clip(target_brightness / current, 0.8, 1.2)
        v = np.clip(v.astype(np.float32) * factor, 0, 255).astype(np.uint8)
    return cv2.cvtColor(cv2.merge([h, s, v]), cv2.COLOR_HSV2BGR)


def correct_flicker_temporal(frame, target_brightness, prev_factor, smoothing=0.7):
    """
    Flicker-Korrektur mit zeitlichem Smoothing.
    Verhindert "Pumpen" bei Szenenwechseln / Zoom / Spielernähe.

    Args:
        frame: Input-Frame
        target_brightness: Ziel-Helligkeit
        prev_factor: Glättungsfaktor vom vorherigen Frame
        smoothing: Alpha für exponential smoothing (0.0-1.0)
                  höher = stärker gesmootht (weniger Flackern, aber träger)

    Returns:
        (corrected_frame, new_factor): korrigierter Frame und neuer Faktor für nächsten Frame
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    current = v.mean()

    if current > 0:
        # Berechne idealen Korrekturfaktor für diesen Frame
        raw_factor = np.clip(target_brightness / current, 0.8, 1.2)

        # Exponential Smoothing: neue_faktor = alt * alpha + roh * (1 - alpha)
        smooth_factor = prev_factor * smoothing + raw_factor * (1 - smoothing)
        smooth_factor = np.clip(smooth_factor, 0.8, 1.2)

        v = np.clip(v.astype(np.float32) * smooth_factor, 0, 255).astype(np.uint8)
        corrected_frame = cv2.cvtColor(cv2.merge([h, s, v]), cv2.COLOR_HSV2BGR)
        return corrected_frame, smooth_factor

    return frame, prev_factor


def apply_clahe(frame):
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    lightness, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lightness = clahe.apply(lightness)
    return cv2.cvtColor(
        cv2.merge([lightness, a_channel, b_channel]),
        cv2.COLOR_LAB2BGR,
    )


def process_video(input_path, output_path, report, roi_bounds=None):
    """Wendet nur die noetigen Korrekturen an und schreibt das Output-Video.

    Args:
        input_path: Pfad zum Input-Video.
        output_path: Pfad fuer das korrigierte Output-Video.
        report: Analysebericht aus analyze_video().
        roi_bounds: Optional (y_top, y_bottom) fuer ROI-basierte Korrektur.

    Aufruf:
        report = analyze_video("input.mp4")
        process_video("input.mp4", "output.mp4", report)
    """
    fixes = _select_fixes(report)

    if not fixes:
        return

    cap, out = _open_video_writer(input_path, output_path)

    flicker_factor = 1.0  # State für Temporal Smoothing

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame, flicker_factor = _apply_selected_fixes(
            frame, fixes, report, roi_bounds, flicker_factor
        )
        out.write(frame)

    cap.release()
    out.release()


def color_correction(input_path, output_path, roi_bounds=None):
    """
    Farb- und Beleuchtungskorrektur.

    Args:
        input_path: Pfad zum Input-Video
        output_path: Pfad zum Output-Video
        roi_bounds: Optional (y_top, y_bottom) um Analyse/Korrektur auf ROI zu beschränken
                    (z.B. von isolate_roi.py)

    Aufruf:
        color_correction("input.mp4", "output.mp4")
        color_correction("input.mp4", "output.mp4", roi_bounds=(120, 900))
    """
    # Orchestriert den kompletten Ablauf: erst analysieren, dann gezielt korrigieren.
    report = analyze_video(input_path, roi_bounds=roi_bounds)
    process_video(input_path, output_path, report, roi_bounds=roi_bounds)
