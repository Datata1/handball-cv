"""2D court visualizer — draws a top-down handball court with player positions.

Renders a bird's-eye-view image of the handball court (40 m x 20 m) with
player dots color-coded by team/class and an optional ball marker.
"""

from __future__ import annotations

import cv2
import numpy as np

from ingestion.pipeline.court_reference import COURT_LENGTH, COURT_WIDTH

# Visualisation canvas settings
CANVAS_W: int = 800  # pixels
CANVAS_H: int = 400  # pixels
MARGIN: int = 40  # pixels around the court

# Derived scale: metres → pixels
_COURT_PX_W = CANVAS_W - 2 * MARGIN
_COURT_PX_H = CANVAS_H - 2 * MARGIN
_SCALE_X = _COURT_PX_W / COURT_LENGTH
_SCALE_Y = _COURT_PX_H / COURT_WIDTH

# Colors (BGR)
BG_COLOR: tuple[int, int, int] = (40, 40, 40)
COURT_COLOR: tuple[int, int, int] = (80, 120, 60)
LINE_COLOR: tuple[int, int, int] = (255, 255, 255)
TEAM_COLORS: dict[str, tuple[int, int, int]] = {
    "A": (50, 50, 255),  # bright red (BGR)
    "B": (255, 180, 0),  # bright blue (BGR)
    "unknown": (180, 180, 180),
}
BALL_COLOR: tuple[int, int, int] = (0, 255, 255)

# Class-based colors
CLASS_COLORS: dict[str, tuple[int, int, int]] = {
    "player": (0, 255, 255),
    "person": (0, 255, 255),
    "goalkeeper": (0, 180, 255),
    "referee": (255, 180, 0),
    "ball": (0, 255, 0),
    "unknown": (180, 180, 180),
}

FONT = cv2.FONT_HERSHEY_SIMPLEX


def _get_player_color(team_or_class: str | None) -> tuple[int, int, int]:
    """Get color for a player. Prefers team color (A/B), falls back to class color."""
    if not team_or_class:
        team_or_class = "unknown"
    key = str(team_or_class)
    # After TeamClassifier, players have team=A/B — check that first
    if key in TEAM_COLORS:
        return TEAM_COLORS[key]
    key_lower = key.lower()
    if key_lower in CLASS_COLORS:
        return CLASS_COLORS[key_lower]
    h = abs(hash(key))
    return (60 + (h % 180), 60 + ((h // 7) % 180), 60 + ((h // 17) % 180))


def _m2px(mx: float, my: float) -> tuple[int, int]:
    """Convert court metres to canvas pixel coordinates."""
    px = int(MARGIN + mx * _SCALE_X)
    py = int(MARGIN + my * _SCALE_Y)
    return px, py


def _draw_arc_m(
    canvas: np.ndarray,  # type: ignore[type-arg]
    center_x: float,
    center_y: float,
    radius_m: float,
    start_deg: float,
    end_deg: float,
    color: tuple[int, int, int],
    thickness: int = 2,
    steps: int = 40,
) -> None:
    angles: np.ndarray = np.linspace(start_deg, end_deg, steps)  # type: ignore[type-arg]
    pts: list[tuple[int, int]] = []
    for angle in angles:
        rad = np.deg2rad(angle)
        x = center_x + radius_m * np.cos(rad)
        y = center_y + radius_m * np.sin(rad)
        pts.append(_m2px(float(x), float(y)))
    cv2.polylines(canvas, [np.array(pts, dtype=np.int32)], False, color, thickness)


def _draw_dashed_arc_m(
    canvas: np.ndarray,  # type: ignore[type-arg]
    center_x: float,
    center_y: float,
    radius_m: float,
    start_deg: float,
    end_deg: float,
    color: tuple[int, int, int],
    thickness: int = 2,
    dash_deg: float = 5.0,
    gap_deg: float = 5.0,
    steps: int = 16,
) -> None:
    angle = start_deg
    while angle < end_deg:
        angle2 = min(angle + dash_deg, end_deg)
        angles: np.ndarray = np.linspace(angle, angle2, steps)  # type: ignore[type-arg]
        pts: list[tuple[int, int]] = []
        for current in angles:
            rad = np.deg2rad(current)
            x = center_x + radius_m * np.cos(rad)
            y = center_y + radius_m * np.sin(rad)
            pts.append(_m2px(float(x), float(y)))
        if len(pts) >= 2:
            cv2.polylines(canvas, [np.array(pts, dtype=np.int32)], False, color, thickness)
        angle += dash_deg + gap_deg


def _draw_dashed_line_m(
    canvas: np.ndarray,  # type: ignore[type-arg]
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    color: tuple[int, int, int],
    thickness: int = 2,
    dash_len_px: int = 10,
    gap_len_px: int = 8,
) -> None:
    p1 = np.array(_m2px(x1, y1), dtype=float)
    p2 = np.array(_m2px(x2, y2), dtype=float)
    v = p2 - p1
    length = float(np.hypot(v[0], v[1]))
    if length <= 0:
        return
    direction = v / length
    pos = 0.0
    while pos < length:
        seg_end = min(pos + dash_len_px, length)
        a = p1 + direction * pos
        b = p1 + direction * seg_end
        cv2.line(canvas, tuple(a.astype(int)), tuple(b.astype(int)), color, thickness)
        pos += dash_len_px + gap_len_px


def _draw_court_fill(canvas: np.ndarray) -> None:  # type: ignore[type-arg]
    """Draw the court surface without markings."""
    tl = _m2px(0, 0)
    br = _m2px(COURT_LENGTH, COURT_WIDTH)
    cv2.rectangle(canvas, tl, br, COURT_COLOR, -1)


def _draw_court_markings(canvas: np.ndarray) -> None:  # type: ignore[type-arg]
    """Draw the handball court outline and markings."""
    tl = _m2px(0, 0)
    br = _m2px(COURT_LENGTH, COURT_WIDTH)
    cv2.rectangle(canvas, tl, br, LINE_COLOR, 2)

    # Center line
    ct = _m2px(COURT_LENGTH / 2, 0)
    cb = _m2px(COURT_LENGTH / 2, COURT_WIDTH)
    cv2.line(canvas, ct, cb, LINE_COLOR, 1)

    # 6m line: two quarter-circles around goal posts + connecting segment
    _draw_arc_m(canvas, 0.0, 8.5, 6.0, -90, 0, LINE_COLOR, 2)
    _draw_arc_m(canvas, 0.0, 11.5, 6.0, 0, 90, LINE_COLOR, 2)
    cv2.line(canvas, _m2px(6.0, 8.5), _m2px(6.0, 11.5), LINE_COLOR, 2)

    _draw_arc_m(canvas, 40.0, 8.5, 6.0, -90, -180, LINE_COLOR, 2)
    _draw_arc_m(canvas, 40.0, 11.5, 6.0, 180, 90, LINE_COLOR, 2)
    cv2.line(canvas, _m2px(34.0, 8.5), _m2px(34.0, 11.5), LINE_COLOR, 2)

    # 9m line (dashed)
    goal_post_top_y = 8.5
    goal_post_bottom_y = 11.5
    radius_9m = 9.0
    angle_clip = float(np.degrees(np.arcsin(goal_post_top_y / radius_9m)))

    _draw_dashed_arc_m(canvas, 0.0, goal_post_top_y, radius_9m, -angle_clip, 0.0, LINE_COLOR, 2)
    _draw_dashed_arc_m(canvas, 0.0, goal_post_bottom_y, radius_9m, 0.0, angle_clip, LINE_COLOR, 2)
    _draw_dashed_line_m(canvas, 9.0, goal_post_top_y, 9.0, goal_post_bottom_y, LINE_COLOR, 2)

    _draw_dashed_arc_m(
        canvas, 40.0, goal_post_top_y, radius_9m, 180.0, 180.0 + angle_clip, LINE_COLOR, 2
    )
    _draw_dashed_arc_m(
        canvas, 40.0, goal_post_bottom_y, radius_9m, 180.0 - angle_clip, 180.0, LINE_COLOR, 2
    )
    _draw_dashed_line_m(canvas, 31.0, goal_post_top_y, 31.0, goal_post_bottom_y, LINE_COLOR, 2)

    # Goal rectangles (3m wide)
    for goal_x in [0.0, COURT_LENGTH]:
        top = _m2px(goal_x, COURT_WIDTH / 2 - 1.5)
        bot = _m2px(goal_x, COURT_WIDTH / 2 + 1.5)
        if goal_x == 0:
            g_tl = (top[0] - 12, top[1])
            g_br = (bot[0], bot[1])
        else:
            g_tl = (top[0], top[1])
            g_br = (bot[0] + 12, bot[1])
        cv2.rectangle(canvas, g_tl, g_br, LINE_COLOR, 2)

    # 7m marks
    for x7 in [7.0, COURT_LENGTH - 7.0]:
        p_top = _m2px(x7, 9.5)
        p_bottom = _m2px(x7, 10.5)
        cv2.line(canvas, p_top, p_bottom, LINE_COLOR, 2)

    # 4m points
    for x4 in [4.0, COURT_LENGTH - 4.0]:
        pt = _m2px(x4, COURT_WIDTH / 2)
        cv2.circle(canvas, pt, 3, BALL_COLOR, -1)

    # Dimension labels
    cv2.putText(canvas, "40m", _m2px(COURT_LENGTH / 2 - 1.5, -1.5), FONT, 0.35, LINE_COLOR, 1)
    cv2.putText(canvas, "20m", (5, MARGIN + _COURT_PX_H // 2), FONT, 0.35, LINE_COLOR, 1)


def render_court(
    players: list[dict[str, object]],
    ball: dict[str, object] | None = None,
    frame_id: int = 0,
    timestamp_s: float = 0.0,
) -> np.ndarray:  # type: ignore[type-arg]
    """Render a single frame of the 2D court with player positions.

    Args:
        players: list of dicts with ``court_pos`` [x, y], ``team``, ``track_id``
        ball: dict with ``court_pos`` [x, y] or ``None``
        frame_id: for HUD display
        timestamp_s: for HUD display

    Returns:
        BGR image (CANVAS_H x CANVAS_W)
    """
    canvas: np.ndarray = np.full((CANVAS_H, CANVAS_W, 3), BG_COLOR, dtype=np.uint8)  # type: ignore[type-arg]
    _draw_court_fill(canvas)
    _draw_court_markings(canvas)

    # Draw players
    on_court = 0
    for p in players:
        cp = p.get("court_pos")
        if cp is None:
            continue
        mx, my = cp  # type: ignore[unpacking]
        if not (-5 <= mx <= COURT_LENGTH + 5 and -5 <= my <= COURT_WIDTH + 5):
            continue
        px, py = _m2px(float(mx), float(my))
        color_key = p.get("class_name") or p.get("team", "unknown")
        color = _get_player_color(str(color_key))
        cv2.circle(canvas, (px, py), 7, color, -1)
        cv2.circle(canvas, (px, py), 7, (255, 255, 255), 1)
        tid = p.get("track_id", "?")
        cv2.putText(canvas, str(tid), (px + 9, py + 4), FONT, 0.32, color, 1)
        on_court += 1

    # Draw ball
    if ball and ball.get("court_pos"):
        bpos = ball["court_pos"]
        assert isinstance(bpos, list | tuple)
        bx, by = float(bpos[0]), float(bpos[1])
        bpx, bpy = _m2px(bx, by)
        cv2.circle(canvas, (bpx, bpy), 5, BALL_COLOR, -1)
        cv2.circle(canvas, (bpx, bpy), 5, (255, 255, 255), 1)

    # HUD
    cv2.putText(
        canvas,
        f"Frame {frame_id} | {timestamp_s:.1f}s | Players: {on_court}",
        (MARGIN, CANVAS_H - 10),
        FONT,
        0.35,
        (200, 200, 200),
        1,
    )

    return canvas
