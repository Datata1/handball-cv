"""Unit tests for ml.analysis.possession — pure function, no DB or GPU needed."""

from ml.analysis.possession import PossessionPhase, detect_phases

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FPS = 25.0


def _frames(
    assignments: list[str | None],
    fps: float = FPS,
) -> list[dict]:  # type: ignore[type-arg]
    """
    Build a frame list from a compact assignment list.

    Each element is "A", "B", or None (no ball carrier).
    frame_id starts at 0; timestamp_s = frame_id / fps.
    """
    return [{"frame_id": i, "timestamp_s": i / fps, "team": t} for i, t in enumerate(assignments)]


# ---------------------------------------------------------------------------
# Basic cases
# ---------------------------------------------------------------------------


class TestEmpty:
    def test_no_frames(self) -> None:
        assert detect_phases([], fps=FPS) == []

    def test_all_none(self) -> None:
        frames = _frames([None] * 50)
        assert detect_phases(frames, fps=FPS) == []


class TestSinglePhase:
    def test_long_enough_phase_is_kept(self) -> None:
        # 50 frames of team A @ 25fps = 2s > min_duration_s=1.5s
        frames = _frames(["A"] * 50)
        phases = detect_phases(frames, min_duration_s=1.5, fps=FPS)
        assert len(phases) == 1
        assert phases[0].team == "A"
        assert phases[0].phase_id == 0

    def test_short_phase_is_discarded(self) -> None:
        # 20 frames = 0.8s < min_duration_s=1.5s
        frames = _frames(["A"] * 20)
        phases = detect_phases(frames, min_duration_s=1.5, fps=FPS)
        assert phases == []


class TestPhaseIds:
    def test_phase_ids_are_sequential(self) -> None:
        # Two distinct long phases
        frames = _frames(["A"] * 50 + ["B"] * 50)
        phases = detect_phases(frames, min_duration_s=1.0, fps=FPS)
        assert len(phases) == 2
        assert [p.phase_id for p in phases] == [0, 1]


# ---------------------------------------------------------------------------
# Gap tolerance
# ---------------------------------------------------------------------------


class TestGapTolerance:
    def test_short_gap_is_bridged(self) -> None:
        # 40 frames A, 5 frames None (0.2s gap < tolerance 1.0s), 40 frames A
        frames = _frames(["A"] * 40 + [None] * 5 + ["A"] * 40)
        phases = detect_phases(frames, gap_tolerance_s=1.0, min_duration_s=1.0, fps=FPS)
        # The gap should be bridged — still one phase for team A
        assert len(phases) == 1
        assert phases[0].team == "A"

    def test_long_gap_splits_phase(self) -> None:
        # 40 frames A, 30 frames None (1.2s > tolerance 1.0s), 40 frames A
        frames = _frames(["A"] * 40 + [None] * 30 + ["A"] * 40)
        phases = detect_phases(frames, gap_tolerance_s=1.0, min_duration_s=1.0, fps=FPS)
        assert len(phases) == 2
        assert all(p.team == "A" for p in phases)


# ---------------------------------------------------------------------------
# Transitions
# ---------------------------------------------------------------------------


class TestTransition:
    def test_team_change_creates_new_phase(self) -> None:
        frames = _frames(["A"] * 50 + ["B"] * 50)
        phases = detect_phases(frames, min_duration_s=1.0, fps=FPS)
        assert len(phases) == 2
        assert phases[0].team == "A"
        assert phases[1].team == "B"

    def test_timestamps_are_correct(self) -> None:
        frames = _frames(["A"] * 50)
        phases = detect_phases(frames, min_duration_s=1.0, fps=FPS)
        assert len(phases) == 1
        p = phases[0]
        assert p.start_frame == 0
        assert p.end_frame == 49
        assert p.start_time_s == 0.0 / FPS
        assert p.end_time_s == 49.0 / FPS


# ---------------------------------------------------------------------------
# PossessionPhase dataclass
# ---------------------------------------------------------------------------


class TestPossessionPhase:
    def test_fields(self) -> None:
        p = PossessionPhase(
            phase_id=0,
            team="A",
            start_frame=0,
            end_frame=24,
            start_time_s=0.0,
            end_time_s=1.0,
        )
        assert p.team == "A"
        assert p.end_frame - p.start_frame == 24
