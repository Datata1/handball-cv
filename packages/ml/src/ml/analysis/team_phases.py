"""
Offense/defense team-phase detector.

Determines which team is attacking and which is defending purely from player
court positions (homography), independent of ball detection: in established
play both teams cluster around one goal, and the defending team's centroid is
always closer to that goal than the offense's. The opposing goalkeeper staying
at the far end pulls the offense centroid even further out, which strengthens
the separation.

Per frame the offense team is labelled when play is established near a goal
and the two centroids are clearly separated. A running phase has hysteresis:
ambiguous frames at the same goal (centroids converged — typical for deep
attacks) continue the phase; it ends only on real transition or a sustained
role swap. The per-frame labels are then smoothed into continuous phases with
the same run-merging used for possession phases.

Court reference:
  x = 0  (left goal)  ←──── 40m ────→  x = 40  (right goal)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ml.analysis.possession import detect_phases

_COURT_LENGTH = 40.0
_HALFWAY_X = 20.0


@dataclass
class TeamPhase:
    phase_id: int
    offense_team: str  # 'A' | 'B'
    defense_team: str
    phase_type: str  # 'attack' (established play near one goal)
    start_frame: int
    end_frame: int
    start_time_s: float
    end_time_s: float


def detect_team_phases(
    frames: list[dict[str, Any]],
    team_avg_x: dict[tuple[int, str], float],
    established_depth_m: float = 15.0,
    min_separation_m: float = 1.5,
    min_duration_s: float = 3.0,
    gap_tolerance_s: float = 2.0,
    swap_tolerance_s: float = 0.5,
    fps: float = 25.0,
) -> list[TeamPhase]:
    """
    Detect offense/defense phases from per-frame team centroids.

    A running phase has hysteresis: while play stays established at the same
    goal, ambiguous frames (centroids too close to separate — common in deep
    attacks, where all attackers push to the 9m line) continue the current
    phase instead of ending it. A phase ends only on real transition (play
    leaves the goal) or a sustained role swap (the other team is clearly the
    offense for at least swap_tolerance_s).

    Args:
        frames:              list of dicts with keys: frame_id, timestamp_s
        team_avg_x:          (frame_id, team) -> mean court_x of that team's
                             on-court players at that frame
        established_depth_m: play counts as established when the midpoint of
                             the two centroids is within this distance of a
                             goal; further out is transition (no label)
        min_separation_m:    minimum difference between the teams' distances
                             to the goal — closer than this is ambiguous
        min_duration_s:      phases shorter than this are discarded
        gap_tolerance_s:     unlabelled gaps shorter than this are bridged
        swap_tolerance_s:    a role swap at the same goal must persist this
                             long before it ends the running phase; shorter
                             flips count as label noise
        fps:                 used to convert durations to frames

    Returns:
        List of TeamPhase objects, ordered by start_frame.
    """
    swap_frames = max(1, int(swap_tolerance_s * fps))

    # Hysteresis context: the goal and offense team of the running phase.
    context_goal: float | None = None
    context_team: str | None = None
    pending_swap = 0

    labelled: list[dict[str, Any]] = []
    for f in frames:
        fid = f["frame_id"]
        ax = team_avg_x.get((fid, "A"))
        bx = team_avg_x.get((fid, "B"))

        # Per-frame evidence: (goal, offense) when clearly separated,
        # (goal, None) when established but ambiguous, None when not established.
        evidence: tuple[float, str | None] | None = None
        if ax is not None and bx is not None:
            mid = (ax + bx) / 2.0
            goal_x = 0.0 if mid < _HALFWAY_X else _COURT_LENGTH
            if abs(mid - goal_x) <= established_depth_m:
                dist_a = abs(ax - goal_x)
                dist_b = abs(bx - goal_x)
                if abs(dist_a - dist_b) >= min_separation_m:
                    # Defense is closer to the goal; offense is the other team.
                    evidence = (goal_x, "A" if dist_a > dist_b else "B")
                else:
                    evidence = (goal_x, None)

        offense: str | None = None
        if evidence is None:
            # Real transition (or no data): the running phase ends here.
            context_goal = None
            context_team = None
            pending_swap = 0
        else:
            goal_x, seen_team = evidence
            if context_team is None or goal_x != context_goal:
                # No running phase at this goal — only a clear separation starts one.
                context_goal, context_team = (goal_x, seen_team) if seen_team else (None, None)
                offense = seen_team
                pending_swap = 0
            elif seen_team is None or seen_team == context_team:
                # Ambiguous or confirming frame: hysteresis keeps the phase alive.
                offense = context_team
                pending_swap = 0
            else:
                # Opposite team appears as offense at the same goal: only a
                # sustained swap ends the phase; brief flips are label noise.
                pending_swap += 1
                if pending_swap >= swap_frames:
                    context_team = seen_team
                    pending_swap = 0
                offense = context_team

        labelled.append({"frame_id": fid, "timestamp_s": f["timestamp_s"], "team": offense})

    runs = detect_phases(
        labelled,
        min_duration_s=min_duration_s,
        gap_tolerance_s=gap_tolerance_s,
        fps=fps,
    )

    return [
        TeamPhase(
            phase_id=r.phase_id,
            offense_team=r.team,
            defense_team="B" if r.team == "A" else "A",
            phase_type="attack",
            start_frame=r.start_frame,
            end_frame=r.end_frame,
            start_time_s=r.start_time_s,
            end_time_s=r.end_time_s,
        )
        for r in runs
    ]
