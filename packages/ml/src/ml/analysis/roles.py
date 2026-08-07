"""
Role assignment for handball attacks (Rollenmodell).

Maps the attacking team's track segments onto the six standard handball
attack positions per time bin, using Hungarian matching against a position
template (the Bialkowski/Lucey role-alignment idea, simplified for handball
where the six attack slots are fixed):

    LA  left wing      RL  left back      RM  centre back
    RR  right back     RA  right wing     KM  pivot (Kreis)

"Left"/"right" are from the attacker's point of view facing the goal.

Working on roles instead of raw track ids makes swap-type plays first-class
signals: a Kreuzen is two players exchanging roles, an Einläufer is a
backcourt role transitioning to KM — both robust against the pass-by
geometry that the plays.py detectors rely on. The role detectors run in
addition to the geometric ones; merge_events deduplicates overlapping finds.

Pure functions — no DB, no GPU. plays.py imports this module lazily inside
detect_plays (this module imports plays for the shared dataclasses).
"""

from __future__ import annotations

from itertools import pairwise

from scipy.optimize import linear_sum_assignment

from ml.analysis.plays import (
    COURT_LENGTH,
    COURT_WIDTH,
    AttackContext,
    PlayEvent,
    TrackSegment,
    _index_at_time,
    _movement_end_idx,
    _movement_start_idx,
    _trajectory,
    context_at,
)

ROLES = ("LA", "RL", "RM", "RR", "RA", "KM")
_BACK_ROLES = frozenset({"LA", "RL", "RM", "RR", "RA"})

# Template slots as (depth from goal, lateral offset from court centre).
# Wings hug the corners close to the goal line, backs sit around the 9m+ arc,
# the pivot lives at the circle. Lateral sign is mirrored per attacked goal so
# "LA" is always the attacker's left.
_TEMPLATE_SPEC: dict[str, tuple[float, float]] = {
    "LA": (3.0, -8.0),
    "RL": (10.5, -4.5),
    "RM": (11.5, 0.0),
    "RR": (10.5, 4.5),
    "RA": (3.0, 8.0),
    "KM": (6.0, 0.0),
}

_ASSIGN_BIN_S = 0.5  # role assignment time resolution
_MAX_ASSIGN_DIST = 8.0  # m — beyond this a player fits no slot (role None)
_MIN_RUN_S = 0.9  # a role must be held this long to count as occupied
_RUN_BREAK_GAP_S = 1.5  # missing assignments longer than this break a run
_MAX_TRANSITION_GAP_S = 3.0  # max time between leaving one role and settling in the next
_SWAP_PAIR_WINDOW_S = 3.0  # both players' transitions must happen within this
_KM_MIN_RUN_S = 1.2  # run-in must hold the pivot role at least this long


def role_template(goal_x: float) -> dict[str, tuple[float, float]]:
    """Template slot positions in court coordinates for the attacked goal."""
    # Facing the goal at x=0 the attacker looks towards -x, so his left hand
    # points towards -y; attacking x=40 mirrors the lateral axis.
    sign = -1.0 if goal_x == 0.0 else 1.0
    template: dict[str, tuple[float, float]] = {}
    for role, (depth, lateral) in _TEMPLATE_SPEC.items():
        x = depth if goal_x == 0.0 else COURT_LENGTH - depth
        template[role] = (x, COURT_WIDTH / 2 + sign * lateral)
    return template


def assign_roles(
    segments: list[TrackSegment],
    contexts: list[AttackContext],
    bin_s: float = _ASSIGN_BIN_S,
) -> list[list[tuple[float, str | None]]]:
    """
    Assign attack roles per time bin, Hungarian-matched against the template.

    Returns one timeline per segment (parallel to `segments`): a list of
    (bin_time, role) samples covering the bins where the segment belonged to
    the attacking team. Players too far from every slot get role None.
    """
    timelines: list[list[tuple[float, str | None]]] = [[] for _ in segments]
    if not contexts:
        return timelines

    templates = {0.0: role_template(0.0), COURT_LENGTH: role_template(COURT_LENGTH)}

    t = min(c.start_s for c in contexts)
    t_end = max(c.end_s for c in contexts)
    while t < t_end:
        t_mid = t + bin_s / 2
        ctx = context_at(contexts, t_mid)
        if ctx is None:
            t += bin_s
            continue

        present: list[tuple[int, int]] = []  # (segment index, sample index)
        for si, seg in enumerate(segments):
            if seg.team == ctx.attacking_team and seg.start_s <= t_mid <= seg.end_s:
                present.append((si, _index_at_time(seg, t_mid)))
        if not present:
            t += bin_s
            continue

        template = templates[ctx.goal_x]
        cost = [
            [
                (
                    (segments[si].xs[idx] - template[role][0]) ** 2
                    + (segments[si].ys[idx] - template[role][1]) ** 2
                )
                ** 0.5
                for role in ROLES
            ]
            for si, idx in present
        ]
        row_idx, col_idx = linear_sum_assignment(cost)
        assigned = {int(r): int(c) for r, c in zip(row_idx, col_idx, strict=True)}

        for p, (si, _) in enumerate(present):
            c = assigned.get(p)
            role = ROLES[c] if c is not None and cost[p][c] <= _MAX_ASSIGN_DIST else None
            timelines[si].append((t_mid, role))

        t += bin_s

    return timelines


def stable_runs(
    timeline: list[tuple[float, str | None]],
    min_run_s: float = _MIN_RUN_S,
) -> list[tuple[str, float, float]]:
    """Collapse a role timeline into stable (role, start_s, end_s) runs."""
    runs: list[tuple[str, float, float]] = []
    cur_role: str | None = None
    run_start = 0.0
    last_t = 0.0

    for t, role in timeline:
        broke = cur_role is not None and t - last_t > _RUN_BREAK_GAP_S
        if role != cur_role or broke:
            if cur_role is not None and last_t - run_start >= min_run_s:
                runs.append((cur_role, run_start, last_t))
            cur_role = role
            run_start = t
        last_t = t

    if cur_role is not None and last_t - run_start >= min_run_s:
        runs.append((cur_role, run_start, last_t))

    return runs


def _transitions(
    runs: list[tuple[str, float, float]],
) -> list[tuple[str, str, float, float]]:
    """(role_from, role_to, t_leave, t_settle) for consecutive run pairs."""
    out: list[tuple[str, str, float, float]] = []
    for (role_a, _, end_a), (role_b, start_b, _) in pairwise(runs):
        if role_a != role_b and start_b - end_a <= _MAX_TRANSITION_GAP_S:
            out.append((role_a, role_b, end_a, start_b))
    return out


def _event_window(seg: TrackSegment, t_leave: float, t_settle: float) -> tuple[float, float]:
    """Movement-phase boundaries around a role transition."""
    i0 = _movement_start_idx(seg, _index_at_time(seg, t_leave))
    i1 = _movement_end_idx(seg, _index_at_time(seg, t_settle))
    return seg.times[i0], seg.times[i1]


def detect_role_swaps(
    segments: list[TrackSegment],
    timelines: list[list[tuple[float, str | None]]],
) -> list[PlayEvent]:
    """
    Kreuzen via role exchange: player X moves role a→b while teammate Y moves
    role b→a within _SWAP_PAIR_WINDOW_S. Catches swaps the pass-by geometry
    misses (large depth offset, slow sequential exchanges) — and names the
    roles involved, which is what a coach actually wants to read.
    """
    all_transitions: list[tuple[int, str, str, float, float]] = []
    for si, timeline in enumerate(timelines):
        for role_from, role_to, t_leave, t_settle in _transitions(stable_runs(timeline)):
            if role_from in _BACK_ROLES and role_to in _BACK_ROLES:
                all_transitions.append((si, role_from, role_to, t_leave, t_settle))

    events: list[PlayEvent] = []
    used: set[int] = set()
    for i, (si, from_i, to_i, leave_i, settle_i) in enumerate(all_transitions):
        if i in used:
            continue
        for j in range(i + 1, len(all_transitions)):
            if j in used:
                continue
            sj, from_j, to_j, leave_j, settle_j = all_transitions[j]
            if si == sj or segments[si].team != segments[sj].team:
                continue
            if from_i != to_j or to_i != from_j:
                continue
            t_mid_i = (leave_i + settle_i) / 2
            t_mid_j = (leave_j + settle_j) / 2
            if abs(t_mid_i - t_mid_j) > _SWAP_PAIR_WINDOW_S:
                continue

            seg_a, seg_b = segments[si], segments[sj]
            t0a, t1a = _event_window(seg_a, leave_i, settle_i)
            t0b, t1b = _event_window(seg_b, leave_j, settle_j)
            t0, t1 = min(t0a, t0b), max(t1a, t1b)
            confidence = 0.6 + (0.15 if abs(t_mid_i - t_mid_j) <= 1.5 else 0.0)
            events.append(
                PlayEvent(
                    play_type="kreuzen",
                    team=seg_a.team,
                    start_frame=seg_a.frame_ids[_index_at_time(seg_a, t0)],
                    end_frame=seg_a.frame_ids[_index_at_time(seg_a, t1)],
                    start_time_s=round(t0, 3),
                    end_time_s=round(t1, 3),
                    confidence=round(confidence, 3),
                    track_ids=[seg_a.track_id, seg_b.track_id],
                    details={
                        "variante": "rollentausch",
                        "rollen": {
                            str(seg_a.track_id): [from_i, to_i],
                            str(seg_b.track_id): [from_j, to_j],
                        },
                        "tracks": [
                            {"track_id": seg_a.track_id, "points": _trajectory(seg_a, t0, t1)},
                            {"track_id": seg_b.track_id, "points": _trajectory(seg_b, t0, t1)},
                        ],
                    },
                )
            )
            used.add(i)
            used.add(j)
            break

    return events


def detect_role_runins(
    segments: list[TrackSegment],
    timelines: list[list[tuple[float, str | None]]],
) -> list[PlayEvent]:
    """
    Einläufer via role transition: a backcourt/wing role settles into the
    pivot role (KM) and holds it. Complements the distance-based detector —
    the role view also works when the run path itself is partially occluded.
    """
    events: list[PlayEvent] = []
    for si, timeline in enumerate(timelines):
        runs = stable_runs(timeline)
        for (role_a, _, end_a), (role_b, start_b, end_b) in pairwise(runs):
            if role_a not in _BACK_ROLES or role_b != "KM":
                continue
            if start_b - end_a > _MAX_TRANSITION_GAP_S:
                continue
            if end_b - start_b < _KM_MIN_RUN_S:
                continue

            seg = segments[si]
            t0, t1 = _event_window(seg, end_a, start_b)
            t1 = max(t1, min(start_b + 1.0, seg.end_s))
            events.append(
                PlayEvent(
                    play_type="einlaeufer",
                    team=seg.team,
                    start_frame=seg.frame_ids[_index_at_time(seg, t0)],
                    end_frame=seg.frame_ids[_index_at_time(seg, t1)],
                    start_time_s=round(t0, 3),
                    end_time_s=round(t1, 3),
                    confidence=0.65,
                    track_ids=[seg.track_id],
                    details={
                        "variante": "rollenwechsel",
                        "rollen": {str(seg.track_id): [role_a, "KM"]},
                        "tracks": [{"track_id": seg.track_id, "points": _trajectory(seg, t0, t1)}],
                    },
                )
            )

    return events


def detect_role_events(
    segments: list[TrackSegment],
    contexts: list[AttackContext],
) -> list[PlayEvent]:
    """Run both role-based detectors on one match worth of segments."""
    timelines = assign_roles(segments, contexts)
    events = detect_role_swaps(segments, timelines)
    events.extend(detect_role_runins(segments, timelines))
    return events
