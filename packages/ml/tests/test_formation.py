"""Unit tests for ml.analysis.formation — pure function, no DB or GPU needed."""

from ml.analysis.formation import classify

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _line(x: float, ys: list[float]) -> list[tuple[float, float]]:
    """Build positions for a straight line of players at the same x."""
    return [(x, y) for y in ys]


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


class TestUnknown:
    def test_too_few_players(self) -> None:
        assert classify([(5.0, 10.0), (6.0, 11.0), (7.0, 9.0)], defending_left=True) == "unknown"

    def test_empty_positions(self) -> None:
        assert classify([], defending_left=True) == "unknown"


# ---------------------------------------------------------------------------
# Attack
# ---------------------------------------------------------------------------


class TestAttack:
    def test_six_players_in_attacking_zone_left_defender(self) -> None:
        # Team defends left (x=0), attacking zone is near x=40
        positions = [(28.0, y) for y in [5, 7, 10, 13, 15, 18]]
        assert classify(positions, defending_left=True) == "attack"

    def test_six_players_in_attacking_zone_right_defender(self) -> None:
        # Team defends right (x=40), attacking zone is near x=0
        positions = [(10.0, y) for y in [5, 7, 10, 13, 15, 18]]
        assert classify(positions, defending_left=False) == "attack"


# ---------------------------------------------------------------------------
# Defensive formations
# ---------------------------------------------------------------------------


class TestSixZero:
    def test_compact_line_no_gap(self) -> None:
        # Six players in a tight line close to own goal (x=0), narrow y-spread
        positions = _line(5.0, [8.0, 9.0, 10.0, 11.0, 12.0, 13.0])
        result = classify(positions, defending_left=True)
        assert result == "6-0"

    def test_compact_line_right_goal(self) -> None:
        # Defending right goal (x=40): players near x=35
        positions = _line(35.0, [8.0, 9.0, 10.0, 11.0, 12.0, 13.0])
        result = classify(positions, defending_left=False)
        assert result == "6-0"


class TestFiveOne:
    def test_one_player_significantly_forward(self) -> None:
        # Five players at x=5, one player at x=9 (4m gap > 3.0 threshold)
        positions = [*_line(5.0, [6.0, 8.0, 10.0, 12.0, 14.0]), (9.0, 10.0)]
        result = classify(positions, defending_left=True)
        assert result == "5-1"


# ---------------------------------------------------------------------------
# Transition
# ---------------------------------------------------------------------------


class TestTransition:
    def test_players_spread_across_court(self) -> None:
        # Players at various x positions — not clustered
        positions = [
            (5.0, 10.0),
            (10.0, 8.0),
            (15.0, 12.0),
            (22.0, 10.0),
            (30.0, 7.0),
            (35.0, 14.0),
        ]
        result = classify(positions, defending_left=True)
        assert result == "transition"
