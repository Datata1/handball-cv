"""Unit tests for ml.analysis.plays — pure functions, no DB or GPU needed.

Synthetic trajectories on the 40x20m court (goals at x=0 / x=40). All
scenarios place the attack at the right goal (x=40): attackers approach from
midfield, the defence stands compactly around x=35..39.
"""

from __future__ import annotations

from itertools import pairwise

from ml.analysis.plays import (
    PlayEvent,
    build_segments,
    context_at,
    detect_plays,
    infer_attack_contexts,
    merge_events,
)

FPS = 30.0


def _rows_for_player(
    track_id: int,
    team: str,
    path: list[tuple[float, float, float]],  # (t, x, y) waypoints
    fps: float = FPS,
) -> list[dict]:  # type: ignore[type-arg]
    """Linearly interpolate waypoints into per-frame rows."""
    rows: list[dict] = []  # type: ignore[type-arg]
    for (t0, x0, y0), (t1, x1, y1) in pairwise(path):
        n = max(1, int((t1 - t0) * fps))
        for k in range(n):
            f = k / n
            t = t0 + f * (t1 - t0)
            rows.append(
                {
                    "frame_id": round(t * fps),
                    "timestamp_s": t,
                    "track_id": track_id,
                    "team": team,
                    "x": x0 + f * (x1 - x0),
                    "y": y0 + f * (y1 - y0),
                }
            )
    return rows


def _static_player(track_id: int, team: str, x: float, y: float, t_end: float) -> list[dict]:  # type: ignore[type-arg]
    return _rows_for_player(track_id, team, [(0.0, x, y), (t_end, x, y)])


def _defence_at_right_goal(t_end: float = 10.0) -> list[dict]:  # type: ignore[type-arg]
    """Six B-defenders compact around the right circle (defending x=40)."""
    rows: list[dict] = []  # type: ignore[type-arg]
    for i in range(6):
        rows.extend(_static_player(100 + i, "B", 36.5, 4.0 + i * 2.5, t_end))
    return rows


def _attack_backline(t_end: float = 10.0, exclude_y: float | None = None) -> list[dict]:  # type: ignore[type-arg]
    """Four static A-attackers spread in the backcourt before the right goal."""
    rows: list[dict] = []  # type: ignore[type-arg]
    for i, y in enumerate((3.0, 8.0, 12.0, 17.0)):
        if exclude_y is not None and abs(y - exclude_y) < 1.0:
            continue
        rows.extend(_static_player(200 + i, "A", 29.0, y, t_end))
    return rows


# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------


class TestBuildSegments:
    def test_splits_at_gaps(self) -> None:
        rows = _rows_for_player(1, "A", [(0.0, 10.0, 10.0), (2.0, 12.0, 10.0)])
        rows += _rows_for_player(1, "A", [(5.0, 20.0, 10.0), (7.0, 22.0, 10.0)])
        segments = build_segments(rows)
        assert len(segments) == 2

    def test_majority_team_vote(self) -> None:
        rows = _rows_for_player(1, "A", [(0.0, 10.0, 10.0), (2.0, 12.0, 10.0)])
        for r in rows[:5]:
            r["team"] = "B"  # simulate flicker
        segments = build_segments(rows)
        assert len(segments) == 1
        assert segments[0].team == "A"

    def test_short_fragments_are_dropped(self) -> None:
        rows = _rows_for_player(1, "A", [(0.0, 10.0, 10.0), (0.3, 11.0, 10.0)])
        assert build_segments(rows) == []

    def test_velocities_are_derived(self) -> None:
        # 2 m/s straight along x
        rows = _rows_for_player(1, "A", [(0.0, 10.0, 10.0), (3.0, 16.0, 10.0)])
        seg = build_segments(rows)[0]
        mid = len(seg.vxs) // 2
        assert abs(seg.vxs[mid] - 2.0) < 0.3
        assert abs(seg.vys[mid]) < 0.1


class TestAttackContext:
    def test_positional_attack_is_detected(self) -> None:
        rows = _defence_at_right_goal() + _attack_backline()
        contexts = infer_attack_contexts(rows)
        ctx = context_at(contexts, 5.0)
        assert ctx is not None
        assert ctx.goal_x == 40.0
        assert ctx.attacking_team == "A"

    def test_spread_field_has_no_context(self) -> None:
        rows: list[dict] = []  # type: ignore[type-arg]
        for i, x in enumerate((5.0, 15.0, 25.0, 35.0)):
            rows.extend(_static_player(i, "A", x, 10.0, 5.0))
            rows.extend(_static_player(50 + i, "B", x, 12.0, 5.0))
        assert infer_attack_contexts(rows) == []


# ---------------------------------------------------------------------------
# Kreuzen
# ---------------------------------------------------------------------------


def _crossing_scenario() -> list[dict]:  # type: ignore[type-arg]
    """Two A-backcourt players swap lanes in front of the right-goal defence."""
    rows = _defence_at_right_goal() + _attack_backline(exclude_y=8.0)
    # Player 1: runs from y=6 to y=12 while approaching slightly; player 2 mirror
    rows += _rows_for_player(1, "A", [(2.0, 29.0, 6.0), (5.0, 31.5, 13.0)])
    rows += _rows_for_player(2, "A", [(2.0, 29.5, 12.5), (5.0, 31.0, 5.5)])
    return rows


class TestKreuzen:
    def test_crossing_is_detected(self) -> None:
        events = [e for e in detect_plays(_crossing_scenario()) if e.play_type == "kreuzen"]
        assert len(events) == 1
        event = events[0]
        assert event.team == "A"
        assert set(event.track_ids) == {1, 2}
        # The swap happens mid-run (~3.5s)
        assert event.start_time_s < 3.5 < event.end_time_s
        assert event.details["goal_x"] == 40.0

    def test_parallel_runs_do_not_cross(self) -> None:
        rows = _defence_at_right_goal() + _attack_backline(exclude_y=8.0)
        rows += _rows_for_player(1, "A", [(2.0, 29.0, 6.0), (5.0, 31.5, 9.0)])
        rows += _rows_for_player(2, "A", [(2.0, 29.5, 12.5), (5.0, 31.0, 15.0)])
        events = [e for e in detect_plays(rows) if e.play_type == "kreuzen"]
        assert events == []

    def test_slow_drift_is_ignored(self) -> None:
        # Same paths but over 12s → speeds well below threshold
        rows = _defence_at_right_goal(14.0) + _attack_backline(14.0, exclude_y=8.0)
        rows += _rows_for_player(1, "A", [(2.0, 29.0, 6.0), (14.0, 31.5, 13.0)])
        rows += _rows_for_player(2, "A", [(2.0, 29.5, 12.5), (14.0, 31.0, 5.5)])
        events = [e for e in detect_plays(rows) if e.play_type == "kreuzen"]
        assert events == []

    def test_opposing_teams_never_cross(self) -> None:
        rows = _defence_at_right_goal() + _attack_backline(exclude_y=8.0)
        rows += _rows_for_player(1, "A", [(2.0, 29.0, 6.0), (5.0, 31.5, 13.0)])
        rows += _rows_for_player(2, "B", [(2.0, 29.5, 12.5), (5.0, 31.0, 5.5)])
        events = [e for e in detect_plays(rows) if e.play_type == "kreuzen"]
        assert events == []

    def test_scissors_variant_is_labelled(self) -> None:
        events = [e for e in detect_plays(_crossing_scenario()) if e.play_type == "kreuzen"]
        assert events[0].details["variante"] == "kreuzen"

    def test_sequential_swap_hinterlaufen_is_detected(self) -> None:
        # The centre back is closed down and drifts towards goal/down-lane while
        # the left back runs in behind him into the middle — a sequential swap
        # with no moment where both players sprint in opposite directions.
        rows = _defence_at_right_goal() + _attack_backline(exclude_y=12.0)
        rows += _rows_for_player(1, "A", [(3.0, 29.0, 10.0), (6.0, 31.5, 8.0)])  # vacates
        rows += _rows_for_player(2, "A", [(3.5, 29.5, 13.5), (5.5, 30.5, 6.5)])  # fills
        events = [e for e in detect_plays(rows) if e.play_type == "kreuzen"]
        assert len(events) == 1
        assert set(events[0].track_ids) == {1, 2}
        assert events[0].details["variante"] == "positionswechsel"

    def test_running_past_a_standing_teammate_is_no_swap(self) -> None:
        # One player crosses a completely static teammate's lateral position —
        # the order flips, but nobody swapped positions.
        rows = _defence_at_right_goal() + _attack_backline(exclude_y=8.0)
        rows += _static_player(1, "A", 29.0, 10.0, 10.0)
        rows += _rows_for_player(2, "A", [(3.0, 29.5, 14.0), (5.0, 30.0, 6.0)])
        events = [e for e in detect_plays(rows) if e.play_type == "kreuzen"]
        assert events == []


# ---------------------------------------------------------------------------
# Parallelstoß
# ---------------------------------------------------------------------------


class TestParallelstoss:
    def test_parallel_push_is_detected(self) -> None:
        rows = _defence_at_right_goal()
        rows += _static_player(200, "A", 29.0, 3.0, 6.0)
        rows += _static_player(201, "A", 29.0, 17.0, 6.0)
        # Two adjacent backcourt players push towards the goal together,
        # keeping their lateral order, and stop just outside the circle.
        rows += _rows_for_player(1, "A", [(2.0, 29.0, 8.0), (4.0, 32.5, 8.0), (6.0, 32.5, 8.0)])
        rows += _rows_for_player(2, "A", [(2.0, 29.0, 12.0), (4.0, 32.5, 12.0), (6.0, 32.5, 12.0)])
        events = [e for e in detect_plays(rows) if e.play_type == "parallelstoss"]
        assert len(events) == 1
        assert events[0].team == "A"
        assert set(events[0].track_ids) == {1, 2}
        assert events[0].details["approach_m"] >= 2.0

    def test_single_push_is_not_parallel(self) -> None:
        rows = _defence_at_right_goal()
        rows += _static_player(200, "A", 29.0, 3.0, 6.0)
        rows += _static_player(201, "A", 29.0, 17.0, 6.0)
        rows += _rows_for_player(1, "A", [(2.0, 29.0, 8.0), (4.0, 32.5, 8.0), (6.0, 32.5, 8.0)])
        rows += _static_player(2, "A", 29.0, 12.0, 6.0)
        events = [e for e in detect_plays(rows) if e.play_type == "parallelstoss"]
        assert events == []


class TestSegmentStitching:
    def test_fragments_across_id_break_are_stitched(self) -> None:
        # One player's run split into two track ids with a 0.4s detection gap
        rows = _rows_for_player(1, "A", [(2.0, 29.0, 6.0), (3.2, 30.0, 8.8)])
        rows += _rows_for_player(11, "A", [(3.6, 30.4, 9.8), (5.0, 31.5, 13.0)])
        segments = build_segments(rows)
        assert len(segments) == 1
        assert segments[0].end_s - segments[0].start_s > 2.5

    def test_distant_fragments_are_not_stitched(self) -> None:
        rows = _rows_for_player(1, "A", [(2.0, 29.0, 6.0), (3.2, 30.0, 8.8)])
        rows += _rows_for_player(11, "A", [(3.6, 35.0, 15.0), (5.0, 36.0, 18.0)])
        segments = build_segments(rows)
        assert len(segments) == 2

    def test_swap_across_track_break_is_detected(self) -> None:
        # The filling player's track id changes right before the order flip —
        # without stitching neither pair sees a sign change.
        rows = _defence_at_right_goal() + _attack_backline(exclude_y=8.0)
        rows += _rows_for_player(1, "A", [(2.0, 29.0, 6.0), (5.0, 31.5, 13.0)])
        rows += _rows_for_player(2, "A", [(2.0, 29.5, 12.5), (3.2, 30.1, 9.7)])
        rows += _rows_for_player(22, "A", [(3.5, 30.2, 9.0), (5.0, 31.0, 5.5)])
        events = [e for e in detect_plays(rows) if e.play_type == "kreuzen"]
        assert len(events) == 1


class TestContextPersistence:
    def test_deep_attack_keeps_context(self) -> None:
        # Strong separation at first, then the attackers push in between the
        # defenders (margin collapses) — the context must persist.
        rows = _defence_at_right_goal(8.0)
        for i, y in enumerate((3.0, 8.0, 12.0, 17.0)):
            rows += _rows_for_player(
                200 + i, "A", [(0.0, 29.0, y), (4.0, 29.0, y), (5.0, 35.8, y), (8.0, 35.8, y)]
            )
        contexts = infer_attack_contexts(rows)
        ctx = context_at(contexts, 6.5)
        assert ctx is not None
        assert ctx.attacking_team == "A"


class TestContextGapBridging:
    def test_short_context_hole_is_bridged(self) -> None:
        # Same positional attack before and after a 2s homography dropout
        rows = _defence_at_right_goal(4.0) + _attack_backline(4.0)
        for i in range(6):
            rows += _rows_for_player(
                100 + i, "B", [(6.0, 36.5, 4.0 + i * 2.5), (10.0, 36.5, 4.0 + i * 2.5)]
            )
        for i, y in enumerate((3.0, 8.0, 12.0, 17.0)):
            rows += _rows_for_player(200 + i, "A", [(6.0, 29.0, y), (10.0, 29.0, y)])
        contexts = infer_attack_contexts(rows)
        ctx = context_at(contexts, 5.0)
        assert ctx is not None
        assert ctx.attacking_team == "A"


# ---------------------------------------------------------------------------
# Einläufer
# ---------------------------------------------------------------------------


class TestEinlaeufer:
    def test_run_in_is_detected(self) -> None:
        rows = _defence_at_right_goal() + _attack_backline(exclude_y=8.0)
        # From the backcourt (dist ~11m) to the circle (dist ~6.5m), then hold
        rows += _rows_for_player(5, "A", [(2.0, 29.0, 10.0), (5.0, 33.6, 10.0), (7.0, 33.6, 10.0)])
        events = [e for e in detect_plays(rows) if e.play_type == "einlaeufer"]
        assert len(events) == 1
        assert events[0].team == "A"
        assert events[0].track_ids == [5]
        assert events[0].details["end_dist_m"] < 7.5

    def test_no_hold_no_event(self) -> None:
        rows = _defence_at_right_goal() + _attack_backline(exclude_y=8.0)
        # Runs in but immediately back out again (feint, not a run-in)
        rows += _rows_for_player(5, "A", [(2.0, 29.0, 10.0), (5.0, 33.6, 10.0), (6.5, 29.0, 10.0)])
        events = [e for e in detect_plays(rows) if e.play_type == "einlaeufer"]
        assert events == []

    def test_defender_run_is_not_an_einlaeufer(self) -> None:
        rows = _defence_at_right_goal() + _attack_backline()
        # A *defender* (team B) moving towards their own goal
        rows += _rows_for_player(5, "B", [(2.0, 29.0, 10.0), (5.0, 33.6, 10.0), (7.0, 33.6, 10.0)])
        events = [e for e in detect_plays(rows) if e.play_type == "einlaeufer"]
        assert events == []


# ---------------------------------------------------------------------------
# Tempogegenstoß
# ---------------------------------------------------------------------------


class TestTempogegenstoss:
    def test_fast_break_is_detected(self) -> None:
        rows: list[dict] = []  # type: ignore[type-arg]
        # Four A-players sprint together from their own half deep into the other
        for i, y in enumerate((4.0, 8.0, 12.0, 16.0)):
            rows += _rows_for_player(i, "A", [(0.0, 8.0, y), (6.0, 30.0, y)])
        # Opponents retreat slowly (below break speed)
        for i, y in enumerate((6.0, 10.0, 14.0)):
            rows += _rows_for_player(50 + i, "B", [(0.0, 20.0, y), (6.0, 28.0, y)])
        events = [e for e in detect_plays(rows) if e.play_type == "tempogegenstoss"]
        assert len(events) == 1
        assert events[0].team == "A"
        assert events[0].details["goal_x"] == 40.0
        assert events[0].details["distance_m"] >= 12.0

    def test_positional_attack_is_not_a_break(self) -> None:
        rows = _defence_at_right_goal() + _attack_backline()
        events = [e for e in detect_plays(rows) if e.play_type == "tempogegenstoss"]
        assert events == []


# ---------------------------------------------------------------------------
# Merging & top level
# ---------------------------------------------------------------------------


class TestMergeEvents:
    def test_duplicate_detections_are_merged(self) -> None:
        a = PlayEvent("kreuzen", "A", 100, 160, 4.0, 6.0, 0.7, [1, 2])
        b = PlayEvent("kreuzen", "A", 130, 190, 4.5, 6.5, 0.8, [3, 2])
        merged = merge_events([a, b])
        assert len(merged) == 1
        assert merged[0].confidence == 0.8
        assert set(merged[0].track_ids) == {1, 2, 3}
        assert merged[0].end_time_s == 6.5

    def test_distinct_events_stay_separate(self) -> None:
        a = PlayEvent("kreuzen", "A", 100, 160, 4.0, 6.0, 0.7, [1, 2])
        b = PlayEvent("kreuzen", "A", 400, 460, 14.0, 16.0, 0.8, [3, 4])
        assert len(merge_events([a, b])) == 2

    def test_different_teams_are_not_merged(self) -> None:
        a = PlayEvent("kreuzen", "A", 100, 160, 4.0, 6.0, 0.7, [1, 2])
        b = PlayEvent("kreuzen", "B", 120, 180, 4.5, 6.5, 0.8, [3, 4])
        assert len(merge_events([a, b])) == 2


class TestDetectPlays:
    def test_empty_input(self) -> None:
        assert detect_plays([]) == []

    def test_static_scene_has_no_events(self) -> None:
        rows = _defence_at_right_goal() + _attack_backline()
        assert detect_plays(rows) == []
