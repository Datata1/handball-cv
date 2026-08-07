"""
Possession phase detector.

Converts the per-frame has_ball / team columns in DuckDB into
continuous possession phases with start/end timestamps.

Short interruptions (e.g. ball out of frame for 1-2 seconds) are smoothed out
so the frontend sees clean phases rather than flickering one-frame changes.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class PossessionPhase:
    phase_id: int
    team: str
    start_frame: int
    end_frame: int
    start_time_s: float
    end_time_s: float


def detect_phases(
    frames: list[dict],  # type: ignore[type-arg]
    min_duration_s: float = 1.5,
    gap_tolerance_s: float = 1.0,
    fps: float = 25.0,
) -> list[PossessionPhase]:
    """
    Convert per-frame ball-carrier data into possession phases.

    Args:
        frames:           list of dicts with keys: frame_id, timestamp_s, team
                          (team is the ball carrier's team for that frame, or None)
        min_duration_s:   phases shorter than this are discarded
        gap_tolerance_s:  gaps in possession shorter than this are bridged
                          (avoids breaking a phase for a single dropped detection)
        fps:              used to convert gap_tolerance to frames

    Returns:
        List of PossessionPhase objects, ordered by start_frame.
    """
    if not frames:
        return []

    gap_frames = int(gap_tolerance_s * fps)
    min_frames = int(min_duration_s * fps)

    # Step 1: build raw per-frame possession sequence
    # Each entry: (frame_id, timestamp_s, team | None)
    seq: list[tuple[int, float, str | None]] = [
        (f["frame_id"], f["timestamp_s"], f.get("team")) for f in frames
    ]

    # Step 2: merge runs with gap tolerance
    # A "run" is a maximal sequence where the same team holds possession,
    # with gaps of <= gap_frames allowed.
    merged: list[tuple[str, int, int, float, float]] = []  # (team, start, end, ts, te)
    current_team: str | None = None
    run_start_frame = 0
    run_start_time = 0.0
    last_team_frame = 0
    last_team_time = 0.0

    for frame_id, ts, team in seq:
        if team and team in ("A", "B"):
            if team != current_team:
                # Check if gap to previous same team is within tolerance
                if current_team is not None:
                    # Commit previous run
                    merged.append(
                        (
                            current_team,
                            run_start_frame,
                            last_team_frame,
                            run_start_time,
                            last_team_time,
                        )
                    )
                current_team = team
                run_start_frame = frame_id
                run_start_time = ts
            last_team_frame = frame_id
            last_team_time = ts
        else:
            # No ball carrier detected — check gap tolerance
            if current_team is not None:
                gap = frame_id - last_team_frame
                if gap > gap_frames:
                    # Gap too large — close current run
                    merged.append(
                        (
                            current_team,
                            run_start_frame,
                            last_team_frame,
                            run_start_time,
                            last_team_time,
                        )
                    )
                    current_team = None

    if current_team is not None:
        merged.append(
            (current_team, run_start_frame, last_team_frame, run_start_time, last_team_time)
        )

    # Step 3: filter by minimum duration and assign phase_ids
    phases = []
    phase_id = 0
    for team, start_f, end_f, start_t, end_t in merged:
        if (end_f - start_f) >= min_frames:
            phases.append(
                PossessionPhase(
                    phase_id=phase_id,
                    team=team,
                    start_frame=start_f,
                    end_frame=end_f,
                    start_time_s=start_t,
                    end_time_s=end_t,
                )
            )
            phase_id += 1

    return phases
