"""
Rule-based formation classifier.

Classifies a team's formation at a single frame based on the court positions
of their players. No ML required — runs independently of the action predictor.

Formation labels:
  Defensive:
    "6-0"   all six players in a compact defensive line near own goal
    "5-1"   five in a line + one forward (pressing)
    "4-2"   two pairs of two (zone defence with covering)
  Offensive:
    "attack" team is positioned in the opponent's half
  Transitional:
    "transition"  players spread across the full court
    "unknown"     fewer than 4 court-mapped players (can't classify reliably)

Court reference:
  x = 0  (left goal)  ←──── 40m ────→  x = 40  (right goal)
  y = 0  (top sideline)                 y = 20  (bottom sideline)
"""

from __future__ import annotations

# Thresholds in metres
_DEFENSIVE_DEPTH = 14.0  # players within this distance of own goal = defensive zone
_OFFENSIVE_DEPTH = 14.0  # players within this distance of opponent goal = attacking zone
_MIN_PLAYERS = 4  # need at least this many mapped players to classify
_COMPACT_Y_SPREAD = 10.0  # max y-spread for a "6-0"-style compact line


def classify(
    positions: list[tuple[float, float]],
    defending_left: bool,
) -> str:
    """
    Classify a team's formation from their current court positions.

    Args:
        positions:      list of (court_x, court_y) for each on-court player
        defending_left: True if this team is defending the left goal (x=0),
                        False if defending the right goal (x=40)

    Returns:
        One of: "6-0", "5-1", "4-2", "attack", "transition", "unknown"
    """
    mapped = [(x, y) for x, y in positions if x is not None and y is not None]
    if len(mapped) < _MIN_PLAYERS:
        return "unknown"

    own_goal_x = 0.0 if defending_left else 40.0
    opp_goal_x = 40.0 if defending_left else 0.0

    def dist_own(x: float) -> float:
        return abs(x - own_goal_x)

    def dist_opp(x: float) -> float:
        return abs(x - opp_goal_x)

    in_own_half = sum(1 for x, _ in mapped if dist_own(x) < 20.0)
    in_defensive_zone = sum(1 for x, _ in mapped if dist_own(x) <= _DEFENSIVE_DEPTH)
    in_attacking_zone = sum(1 for x, _ in mapped if dist_opp(x) <= _OFFENSIVE_DEPTH)

    n = len(mapped)

    # Team is primarily attacking
    if in_attacking_zone >= n - 1:
        return "attack"

    # Team is in transition (spread across court)
    if in_own_half < n - 2:
        return "transition"

    # Team is in defensive shape — classify by depth and spread
    if in_defensive_zone < _MIN_PLAYERS:
        return "transition"

    ys = [y for _, y in mapped if dist_own(_) <= _DEFENSIVE_DEPTH]
    # Re-derive properly with filtering
    ys = [y for x, y in mapped if dist_own(x) <= _DEFENSIVE_DEPTH]
    y_spread = max(ys) - min(ys) if len(ys) >= 2 else 0.0

    xs = sorted(dist_own(x) for x, _ in mapped if dist_own(x) <= _DEFENSIVE_DEPTH)

    if len(xs) < 2:
        return "unknown"

    # Check for distinct depth layers
    depth_gap = max(xs[i + 1] - xs[i] for i in range(len(xs) - 1))

    if y_spread <= _COMPACT_Y_SPREAD and depth_gap <= 2.0:
        return "6-0"
    elif depth_gap >= 3.0 and len(xs) >= 5:
        # One player significantly ahead of the rest
        return "5-1"
    else:
        return "4-2"
