"""
Frame annotator — draws pipeline output onto raw video frames.

Uses only cv2 + numpy (core deps, no GPU required).
Optionally renders a PiP (picture-in-picture) 2D court overlay showing
projected player and ball positions.
"""

from __future__ import annotations

import cv2
import numpy as np

from ingestion.types import BallState, FrameState, PlayerState
from ingestion.visualization.court_viz import render_court

_FONT = cv2.FONT_HERSHEY_SIMPLEX
_TEAM_COLORS: dict[str, tuple[int, int, int]] = {
    "A": (50, 50, 255),  # bright red (BGR)
    "B": (255, 180, 0),  # bright blue (BGR)
    "player": (0, 255, 255),
    "goalkeeper": (0, 200, 255),
    "referee": (0, 255, 255),
    "unknown": (180, 180, 180),
}
_BALL_COLOR: tuple[int, int, int] = (0, 255, 255)

# PiP settings
_PIP_SCALE: float = 0.4  # court panel width relative to video width
_PIP_MIN_W: int = 300
_PIP_MARGIN: int = 16
_PIP_ALPHA: float = 0.75


class FrameAnnotator:
    """Draws bounding boxes, team labels, ball, and HUD onto a copy of each frame."""

    def annotate(self, frame: np.ndarray, state: FrameState) -> np.ndarray:  # type: ignore[type-arg]
        out: np.ndarray = frame.copy()  # type: ignore[type-arg]
        for player in state.players:
            _draw_player(out, player)
        if state.ball is not None:
            _draw_ball(out, state.ball)
        _draw_hud(out, state)
        _draw_court_pip(out, state)
        return out


def _draw_player(frame: np.ndarray, p: PlayerState) -> None:  # type: ignore[type-arg]
    b = p.bbox
    color = _TEAM_COLORS.get(p.team, _TEAM_COLORS["unknown"])
    cv2.rectangle(frame, (b.x1, b.y1), (b.x2, b.y2), color, 2)
    label = f"#{p.track_id} {p.team} {p.confidence:.0%}"
    cv2.putText(frame, label, (b.x1, max(b.y1 - 6, 10)), _FONT, 0.45, color, 1, cv2.LINE_AA)


def _draw_ball(frame: np.ndarray, ball: BallState) -> None:  # type: ignore[type-arg]
    cx = int(ball.bbox.center[0])
    cy = int(ball.bbox.center[1])
    r = max(ball.bbox.width // 2, 8)
    cv2.circle(frame, (cx, cy), r, _BALL_COLOR, 2)


def _draw_hud(frame: np.ndarray, state: FrameState) -> None:  # type: ignore[type-arg]
    lines = [
        f"Frame {state.frame_id} | {state.timestamp_s:.1f}s",
        f"Players: {state.on_court_count}/{state.player_count}",
    ]
    for i, line in enumerate(lines):
        y = 22 + i * 20
        cv2.putText(frame, line, (8, y), _FONT, 0.5, (255, 255, 255), 1, cv2.LINE_AA)


def _draw_court_pip(frame: np.ndarray, state: FrameState) -> None:  # type: ignore[type-arg]
    """Render 2D court overlay as picture-in-picture at the bottom center."""
    court_players: list[dict[str, object]] = [
        {
            "court_pos": [p.court_pos[0], p.court_pos[1]],
            "team": p.team,
            "track_id": p.track_id,
        }
        for p in state.players
        if p.court_pos is not None
    ]

    if not court_players:
        return  # no projected positions — skip PiP

    ball_dict: dict[str, object] | None = None
    if state.ball is not None and state.ball.court_pos is not None:
        ball_dict = {"court_pos": [state.ball.court_pos[0], state.ball.court_pos[1]]}

    court_img = render_court(
        court_players,
        ball=ball_dict,
        frame_id=state.frame_id,
        timestamp_s=state.timestamp_s,
    )

    # Scale court panel
    fh, fw = frame.shape[:2]
    pip_w = max(_PIP_MIN_W, int(fw * _PIP_SCALE))
    pip_h = int(pip_w * court_img.shape[0] / court_img.shape[1])
    court_small: np.ndarray = cv2.resize(court_img, (pip_w, pip_h), interpolation=cv2.INTER_AREA)  # type: ignore[type-arg]

    # Position: bottom center
    x0 = (fw - pip_w) // 2
    y0 = fh - pip_h - _PIP_MARGIN
    x0 = max(0, min(x0, fw - pip_w))
    y0 = max(0, min(y0, fh - pip_h))

    # Alpha blend
    roi = frame[y0 : y0 + pip_h, x0 : x0 + pip_w].astype(np.float32)
    overlay = court_small.astype(np.float32)
    blended = (_PIP_ALPHA * overlay + (1.0 - _PIP_ALPHA) * roi).astype(np.uint8)
    frame[y0 : y0 + pip_h, x0 : x0 + pip_w] = blended

    # Border
    cv2.rectangle(frame, (x0 - 1, y0 - 1), (x0 + pip_w + 1, y0 + pip_h + 1), (255, 255, 255), 1)
