"""Reference coordinates for the handball court keypoints.

The coordinate system is on the playing surface:
  - x: court length in metres, left to right (0 → 40)
  - y: court width in metres, top to bottom (0 → 20)

The point order must match the YOLO-Pose keypoint indices exactly
(trained on handball_court_combined_full.yaml with 24 keypoints).
"""

from __future__ import annotations

# Index order per YOLO-Pose training config
COURT_REFERENCE: dict[int, tuple[float, float]] = {
    0: (0.0, 0.0),  # links_ecke_rechts (top-left corner)
    1: (0.0, 2.5),  # links_6m_rechts
    2: (0.0, 8.5),  # links_tor_rechts
    3: (0.0, 11.5),  # links_tor_links
    4: (0.0, 17.5),  # links_6m_links
    5: (0.0, 20.0),  # links_ecke_links (bottom-left corner)
    6: (3.0, 0.0),  # links_9m_rechts
    7: (3.0, 20.0),  # links_9m_links
    8: (4.0, 10.0),  # links_4m
    9: (7.0, 9.5),  # links_7m_rechts
    10: (7.0, 10.5),  # links_7m_links
    11: (20.0, 0.0),  # mitte_oben
    12: (20.0, 20.0),  # mitte_unten
    13: (40.0, 0.0),  # rechts_ecke_links (top-right corner)
    14: (40.0, 2.5),  # rechts_6m_links
    15: (40.0, 8.5),  # rechts_tor_links
    16: (40.0, 11.5),  # rechts_tor_rechts
    17: (40.0, 17.5),  # rechts_6m_rechts
    18: (40.0, 20.0),  # rechts_ecke_rechts (bottom-right corner)
    19: (37.0, 0.0),  # rechts_9m_links
    20: (37.0, 20.0),  # rechts_9m_rechts
    21: (36.0, 10.0),  # rechts_4m
    22: (33.0, 9.5),  # rechts_7m_links
    23: (33.0, 10.5),  # rechts_7m_rechts
}

NUM_KEYPOINTS = 24

# Court physical dimensions (metres)
COURT_LENGTH: float = 40.0
COURT_WIDTH: float = 20.0
