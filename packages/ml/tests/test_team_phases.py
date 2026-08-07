"""Unit tests for ml.analysis.team_phases — pure function, no DB or GPU needed."""

from ml.analysis.team_phases import detect_team_phases

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FPS = 25.0


def _frames(n: int, start: int = 0) -> list[dict]:  # type: ignore[type-arg]
    return [{"frame_id": start + i, "timestamp_s": (start + i) / FPS} for i in range(n)]


def _centroids(
    frame_ids: range,
    a_x: float | list[float] | None,
    b_x: float | list[float] | None,
) -> dict[tuple[int, str], float]:
    """Build a team_avg_x dict with constant or per-frame centroids; None omits the team."""
    avg_x: dict[tuple[int, str], float] = {}
    for i, fid in enumerate(frame_ids):
        if a_x is not None:
            avg_x[(fid, "A")] = a_x[i] if isinstance(a_x, list) else a_x
        if b_x is not None:
            avg_x[(fid, "B")] = b_x[i] if isinstance(b_x, list) else b_x
    return avg_x


# ---------------------------------------------------------------------------
# Basic cases
# ---------------------------------------------------------------------------


class TestEmpty:
    def test_no_frames(self) -> None:
        assert detect_team_phases([], {}, fps=FPS) == []

    def test_no_centroid_data(self) -> None:
        assert detect_team_phases(_frames(200), {}, fps=FPS) == []

    def test_missing_one_team(self) -> None:
        # Only team A has centroids — can't compare, no phases.
        avg_x = _centroids(range(200), a_x=10.0, b_x=None)
        assert detect_team_phases(_frames(200), avg_x, fps=FPS) == []


class TestEstablishedAttack:
    def test_attack_on_right_goal(self) -> None:
        # Defense B packed at x=34 (6m from right goal), offense A at x=28 (12m).
        avg_x = _centroids(range(200), a_x=28.0, b_x=34.0)
        phases = detect_team_phases(_frames(200), avg_x, fps=FPS)
        assert len(phases) == 1
        assert phases[0].offense_team == "A"
        assert phases[0].defense_team == "B"
        assert phases[0].phase_type == "attack"

    def test_attack_on_left_goal(self) -> None:
        # Defense A packed at x=5, offense B at x=11 — same teams, other goal.
        avg_x = _centroids(range(200), a_x=5.0, b_x=11.0)
        phases = detect_team_phases(_frames(200), avg_x, fps=FPS)
        assert len(phases) == 1
        assert phases[0].offense_team == "B"
        assert phases[0].defense_team == "A"

    def test_offense_goalkeeper_far_away_still_classified(self) -> None:
        # Offense centroid pulled back by its goalkeeper (7 players: 6 at ~11m
        # + GK at 38m -> centroid ~ x=25 for a right-goal attack at x=40).
        avg_x = _centroids(range(200), a_x=25.0, b_x=34.0)
        phases = detect_team_phases(_frames(200), avg_x, fps=FPS)
        assert len(phases) == 1
        assert phases[0].offense_team == "A"


class TestUnlabelledPlay:
    def test_midcourt_transition_gives_no_phase(self) -> None:
        # Both teams running through the middle — midpoint ~20m from any goal.
        avg_x = _centroids(range(200), a_x=18.0, b_x=22.0)
        assert detect_team_phases(_frames(200), avg_x, fps=FPS) == []

    def test_ambiguous_separation_gives_no_phase(self) -> None:
        # Centroids closer together than min_separation_m near the goal.
        avg_x = _centroids(range(200), a_x=33.5, b_x=34.0)
        assert detect_team_phases(_frames(200), avg_x, fps=FPS) == []

    def test_short_phase_is_discarded(self) -> None:
        # 50 frames = 2.0s < min_duration_s default of 3.0s.
        avg_x = _centroids(range(50), a_x=28.0, b_x=34.0)
        assert detect_team_phases(_frames(50), avg_x, fps=FPS) == []


class TestSmoothing:
    def test_brief_ambiguity_is_bridged(self) -> None:
        # 100 attack frames, 20 ambiguous (0.8s < 2s gap tolerance), 100 attack.
        a = [28.0] * 100 + [34.0] * 20 + [28.0] * 100
        b = [34.0] * 100 + [34.0] * 20 + [34.0] * 100
        avg_x = _centroids(range(220), a_x=a, b_x=b)
        phases = detect_team_phases(_frames(220), avg_x, fps=FPS)
        assert len(phases) == 1
        assert phases[0].start_frame == 0
        assert phases[0].end_frame == 219

    def test_long_transition_splits_phases(self) -> None:
        # Attack right goal, 100 frames (4s) mid-court, then attack left goal.
        a = [28.0] * 100 + [20.0] * 100 + [5.0] * 100
        b = [34.0] * 100 + [20.0] * 100 + [11.0] * 100
        avg_x = _centroids(range(300), a_x=a, b_x=b)
        phases = detect_team_phases(_frames(300), avg_x, fps=FPS)
        assert len(phases) == 2
        # First: A attacks right (B defends at 34); second: B attacks left (A defends at 5).
        assert phases[0].offense_team == "A"
        assert phases[1].offense_team == "B"

    def test_offense_change_creates_new_phase(self) -> None:
        # Same goal, but the teams swap roles (turnover + immediate re-attack).
        a = [28.0] * 100 + [34.0] * 100
        b = [34.0] * 100 + [28.0] * 100
        avg_x = _centroids(range(200), a_x=a, b_x=b)
        phases = detect_team_phases(_frames(200), avg_x, fps=FPS)
        assert [p.offense_team for p in phases] == ["A", "B"]


class TestHysteresis:
    def test_separation_collapse_mid_phase_keeps_phase_alive(self) -> None:
        # The real-world case: clear attack, then 10s of converged centroids
        # (deep attack, label mixing), then clear again — must stay ONE phase,
        # even though the ambiguous stretch exceeds gap_tolerance_s.
        a = [28.0] * 100 + [32.0] * 250 + [28.0] * 100
        b = [34.0] * 100 + [32.5] * 250 + [34.0] * 100
        avg_x = _centroids(range(450), a_x=a, b_x=b)
        phases = detect_team_phases(_frames(450), avg_x, fps=FPS)
        assert len(phases) == 1
        assert phases[0].offense_team == "A"
        assert phases[0].start_frame == 0
        assert phases[0].end_frame == 449

    def test_ambiguous_frames_without_prior_phase_stay_unlabelled(self) -> None:
        # Converged centroids near a goal but no established phase before:
        # hysteresis has nothing to continue — no phase.
        avg_x = _centroids(range(200), a_x=32.0, b_x=32.5)
        assert detect_team_phases(_frames(200), avg_x, fps=FPS) == []

    def test_brief_role_flip_is_noise(self) -> None:
        # 5 frames (0.2s < swap_tolerance 0.5s) where B looks like the offense
        # mid-attack — label noise, the A phase continues uninterrupted.
        a = [28.0] * 100 + [34.0] * 5 + [28.0] * 100
        b = [34.0] * 100 + [28.0] * 5 + [34.0] * 100
        avg_x = _centroids(range(205), a_x=a, b_x=b)
        phases = detect_team_phases(_frames(205), avg_x, fps=FPS)
        assert len(phases) == 1
        assert phases[0].offense_team == "A"

    def test_sustained_role_swap_ends_phase(self) -> None:
        # B is clearly the offense at the same goal for 4s (>> swap tolerance):
        # a real turnover — two phases with swapped roles.
        a = [28.0] * 100 + [34.0] * 100
        b = [34.0] * 100 + [28.0] * 100
        avg_x = _centroids(range(200), a_x=a, b_x=b)
        phases = detect_team_phases(_frames(200), avg_x, fps=FPS)
        assert [p.offense_team for p in phases] == ["A", "B"]

    def test_transition_clears_hysteresis_context(self) -> None:
        # Attack at the right goal, real transition, then ambiguous frames at
        # the LEFT goal: the old context must not leak to the other goal.
        a = [28.0] * 100 + [20.0] * 100 + [5.0] * 100
        b = [34.0] * 100 + [20.0] * 100 + [5.3] * 100
        avg_x = _centroids(range(300), a_x=a, b_x=b)
        phases = detect_team_phases(_frames(300), avg_x, fps=FPS)
        assert len(phases) == 1
        assert phases[0].offense_team == "A"
        assert phases[0].end_frame <= 199


class TestMetadata:
    def test_phase_ids_sequential_and_times_match(self) -> None:
        a = [28.0] * 100 + [20.0] * 100 + [5.0] * 100
        b = [34.0] * 100 + [20.0] * 100 + [11.0] * 100
        avg_x = _centroids(range(300), a_x=a, b_x=b)
        phases = detect_team_phases(_frames(300), avg_x, fps=FPS)
        assert [p.phase_id for p in phases] == [0, 1]
        for p in phases:
            assert p.start_time_s == p.start_frame / FPS
            assert p.end_time_s == p.end_frame / FPS
