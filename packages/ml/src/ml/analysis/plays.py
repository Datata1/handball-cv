"""
Rule-based play detection (Spielzugerkennung) on top-view court coordinates.

Detects offensive plays from the homography-mapped player positions in DuckDB
(players.court_x / court_y, court 40m x 20m, goals at x=0 and x=40):

  "kreuzen"          two attackers swap their lateral order in front of the
                     defence — both the simultaneous scissors crossing and the
                     sequential swap (Hinterlaufen); see details["variante"]
  "einlaeufer"       a backcourt attacker runs in towards the 6m circle
                     (Einläufer / Kreisläufer-Einlauf)
  "parallelstoss"    two adjacent backcourt attackers push towards the goal
                     together (Druck machen)
  "tempogegenstoss"  the whole team moves quickly from its own half into the
                     opponent half (fast break)

Event boundaries are derived from movement phases: a play starts when the
first involved player leaves his standing position and ends when all involved
players come to rest again (capped, see _MOVE_LOOKBACK_S).

Everything in this module is a pure function — no DB, no GPU. SQL reads and
play_events writes live in ml.scoring (single DB-writer convention).

Why rule-based and not DTW: track IDs are not stable player identities (tracks
break after seconds), team labels flicker, and no labelled reference plays
exist to build templates from. Geometric predicates over short sliding windows
work on track *fragments* and need no training data. See DESIGN.md next to
this file for the full reasoning and threshold derivation.

Input row format (one row per player per frame, court-mapped only):
    {"frame_id": int, "timestamp_s": float, "track_id": int,
     "team": "A"|"B"|"unknown", "x": float, "y": float}

All thresholds are *time-based* (seconds, metres, m/s) so detection behaves
identically at 30 fps and at strided ingestion rates (e.g. every 2nd frame).
"""

from __future__ import annotations

import bisect
from dataclasses import dataclass, field
from itertools import pairwise
from typing import Any

# ---------------------------------------------------------------------------
# Court geometry (must match ingestion.pipeline.court_reference)
# ---------------------------------------------------------------------------

COURT_LENGTH = 40.0  # metres, goals at x=0 and x=40
COURT_WIDTH = 20.0  # metres, sidelines at y=0 and y=20

# ---------------------------------------------------------------------------
# Preprocessing thresholds
# ---------------------------------------------------------------------------

_MAX_GAP_S = 1.0  # split a track into segments at detection gaps longer than this
_MIN_SEGMENT_S = 1.0  # discard segments shorter than this
_MIN_SEGMENT_POINTS = 5
_SMOOTH_WINDOW = 5  # centred moving-average window (samples) for x/y smoothing

# ByteTrack drops and re-issues track ids constantly (~1000 ids for 14 players
# in 2 minutes), so one run by one player often spans several ids. Fragments
# are stitched back together when a new fragment starts shortly after another
# ends, close to its last position. Conservative thresholds + an ambiguity
# margin avoid joining two different players during an occlusion hand-off.
_STITCH_MAX_GAP_S = 0.7  # max time gap between fragment end and start
_STITCH_BASE_DIST = 1.0  # m — base distance allowance at gap 0
_STITCH_SPEED = 2.5  # m/s — allowance grows with the gap duration
_STITCH_MAX_DIST = 2.5  # m — hard cap of the allowance
_STITCH_AMBIGUITY_MARGIN = 0.8  # m — runner-up must be this much farther

# ---------------------------------------------------------------------------
# Attack-context thresholds
# ---------------------------------------------------------------------------

_CONTEXT_BIN_S = 1.0  # time resolution of attack-context inference
_CONTEXT_MIN_POINTS = 3  # min positions per team per bin
_CONTEXT_MAX_HOLE_S = 2.0  # bridge holes up to this between identical contexts
# Once an attack is established it persists through bins where the margin
# collapses (deep attacks intermingle attackers and defenders, so the
# mean-distance separation degrades). Switching the attacking team at the
# same goal needs this many consecutive bins of clear opposite evidence.
_CONTEXT_SWITCH_BINS = 2
# A positional attack clusters all players near one goal. If the median x of
# all players sits between these bounds the situation is transition/unclear.
_CONTEXT_GOAL_NEAR_X = 14.0
# The attacking team stands *further* from the goal than the compact defence;
# require at least this margin (metres) between the team means.
_CONTEXT_MIN_MARGIN = 1.0

# ---------------------------------------------------------------------------
# Kreuzen / Positionstausch (lateral order swap) thresholds
#
# Covers both variants: the simultaneous scissors crossing AND the sequential
# swap ("Hinterlaufen" — one player vacates his lane, a teammate fills it).
# The sequential variant has no moment where both players sprint in opposite
# directions, so only ONE player must be running; instead a swap must show a
# clear lateral separation on both sides of the order flip to reject jitter.
# ---------------------------------------------------------------------------

_SWAP_MIN_OVERLAP_S = 0.8  # two tracks must coexist at least this long
_SWAP_MIN_SPEED = 1.0  # m/s — at least one player running at the flip
_SWAP_MAX_DIST = 4.0  # m — pass-by distance (depth offset when running behind)
_SWAP_MIN_SEPARATION = 1.5  # m — clear lateral order before AND after the flip
_SWAP_CONTEXT_S = 2.0  # s — window around the flip to measure separation
_SWAP_ZONE_MIN = 4.0  # m — distance band to the attacked goal where
_SWAP_ZONE_MAX = 17.0  # backcourt position swaps happen
_SWAP_MAX_WINDOW_S = 3.5  # s — hard cap of the event window around the flip
_SWAP_REARM_S = 1.0  # s — ignore further flips of the same pair for this long
_SWAP_MIN_DEFENDERS = 2  # no-context fallback: defensive screen required
# Both players must really change position during the event — a runner passing
# a *standing* teammate flips the lateral order too, but is not a swap.
_SWAP_MIN_PARTNER_MOVE = 1.0  # m net displacement of each player
# Both running fast, opposite lateral directions, passing close ⇒ the classic
# scissors crossing — reported with higher confidence (details["variante"]).
_SWAP_SCISSORS_SPEED = 1.2
_SWAP_SCISSORS_DIST = 2.5

# ---------------------------------------------------------------------------
# Movement-phase event boundaries
#
# A play starts when the first involved player leaves his standing position
# and ends when all involved players come to rest again — instead of a fixed
# window around the trigger moment. Implemented as a walk along the speed
# series away from the trigger sample.
# ---------------------------------------------------------------------------

_REST_SPEED = 0.8  # m/s — below this a player counts as standing
_MOVE_LOOKBACK_S = 3.0  # s — max extension of an event into past/future

# ---------------------------------------------------------------------------
# Parallelstoß (parallel thrust) thresholds
# ---------------------------------------------------------------------------

_PUSH_MIN_OVERLAP_S = 1.0  # s — both tracks must coexist at least this long
_PUSH_WINDOW_S = 2.5  # s — both must gain depth within this window
_PUSH_MIN_APPROACH = 2.0  # m — distance gained towards the goal, each player
_PUSH_MIN_SPEED = 1.2  # m/s — peak speed of each player during the push
_PUSH_LATERAL_MIN = 1.5  # m — adjacent lanes (not the same player twice)
_PUSH_LATERAL_MAX = 8.0
_PUSH_ZONE_MIN_START = 7.0  # m — start in the backcourt, not at the circle
_PUSH_ZONE_MAX = 17.0
_PUSH_REARM_S = 1.0  # s — suppress re-triggering right after an event

# ---------------------------------------------------------------------------
# Einläufer (run-in towards the circle) thresholds
# ---------------------------------------------------------------------------

_RUNIN_START_DIST = 9.5  # m — run starts in the backcourt (outside 9m)
_RUNIN_END_DIST = 7.5  # m — and ends near the circle
_RUNIN_MIN_APPROACH = 3.0  # m — net distance gained towards the goal
_RUNIN_MAX_RUN_S = 5.0  # s — approach must happen within this window
_RUNIN_MONOTONIC_FRAC = 0.7  # fraction of samples that must move goal-wards
_RUNIN_HOLD_S = 1.0  # s — player stays near the circle afterwards
_RUNIN_HOLD_DIST = 8.5  # m — "near the circle" for the hold check
_RUNIN_MAX_START_DIST = 17.0  # m — run starts inside the attack space (not a counter)

# ---------------------------------------------------------------------------
# Tempogegenstoß (fast break) thresholds
# ---------------------------------------------------------------------------

_BREAK_MIN_PLAYERS = 3  # centroid needs at least this many court-mapped players
_BREAK_MIN_SPEED = 2.0  # m/s — sustained centroid speed towards the goal
# Faster than a human sprint = centroid jump caused by tracks entering/leaving
# the camera view, not actual movement.
_BREAK_MAX_SPEED = 7.0
_BREAK_MIN_DISPLACEMENT = 12.0  # m — net centroid movement
_BREAK_MAX_DURATION_S = 10.0  # s — the displacement must happen within this
_BREAK_DIP_TOLERANCE_S = 0.6  # s — brief speed dips that do not end the run
_BREAK_START_OWN_HALF_X = 20.0  # centroid starts in its own half
_BREAK_CROSS_MARGIN = 2.0  # m — centroid ends clearly inside the opponent half
_BREAK_CONTEXT_LOOKAHEAD_S = 4.0  # s — window after the run to find the attack context

# ---------------------------------------------------------------------------
# Attack sequences (Angriffe) + outcome attribution
# ---------------------------------------------------------------------------

_SEQ_MIN_DURATION_S = 4.0  # a real positional attack lasts at least this long
_SEQ_GOAL_GRACE_S = 6.0  # a goal this soon after the attack window counts for it
_SEQ_EVENT_TOLERANCE_S = 2.0  # events may start slightly before the context opens

# ---------------------------------------------------------------------------
# Event post-processing
# ---------------------------------------------------------------------------

_MERGE_GAP_S = 1.0  # merge same-type same-team events closer than this
_TRAJECTORY_MAX_POINTS = 25  # downsampled points stored per track for the UI


@dataclass
class TrackSegment:
    """A gap-free, smoothed run of one track_id with derived velocities."""

    track_id: int
    team: str  # majority vote over the segment: 'A' | 'B' | 'unknown'
    frame_ids: list[int]
    times: list[float]
    xs: list[float]
    ys: list[float]
    vxs: list[float]  # m/s, central differences on the smoothed positions
    vys: list[float]

    def index_of_frame(self, frame_id: int) -> int | None:
        i = bisect.bisect_left(self.frame_ids, frame_id)
        if i < len(self.frame_ids) and self.frame_ids[i] == frame_id:
            return i
        return None

    @property
    def start_s(self) -> float:
        return self.times[0]

    @property
    def end_s(self) -> float:
        return self.times[-1]


@dataclass
class AttackContext:
    """One time bin of inferred attack direction during a positional attack."""

    start_s: float
    end_s: float
    goal_x: float  # the attacked goal: 0.0 or 40.0
    attacking_team: str  # 'A' | 'B'


@dataclass
class PlayEvent:
    """A detected play with timestamps, involved tracks and UI metadata."""

    play_type: str  # 'kreuzen' | 'einlaeufer' | 'parallelstoss' | 'tempogegenstoss'
    team: str  # attacking team: 'A' | 'B'
    start_frame: int
    end_frame: int
    start_time_s: float
    end_time_s: float
    confidence: float  # heuristic 0..1
    track_ids: list[int]
    details: dict[str, Any] = field(default_factory=dict)
    sequence_id: int | None = None  # attack sequence this event belongs to


@dataclass
class AttackSequence:
    """One positional attack: a contiguous attack-context span with outcome."""

    sequence_id: int
    team: str  # attacking team
    goal_x: float  # attacked goal
    start_frame: int
    end_frame: int
    start_time_s: float
    end_time_s: float
    outcome: str  # 'goal' | 'no_goal' | 'unknown' (no scoreboard data)
    event_count: int


# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------


def _moving_average(values: list[float], window: int) -> list[float]:
    """Centred moving average; edges use a shrunken window."""
    if window <= 1 or len(values) <= 2:
        return list(values)
    half = window // 2
    out: list[float] = []
    for i in range(len(values)):
        lo = max(0, i - half)
        hi = min(len(values), i + half + 1)
        out.append(sum(values[lo:hi]) / (hi - lo))
    return out


def _majority_team(chunk: list[dict[str, Any]]) -> str:
    """Majority team label of a row chunk (robust against per-frame flicker)."""
    counts: dict[str, int] = {}
    for r in chunk:
        counts[str(r["team"])] = counts.get(str(r["team"]), 0) + 1
    return max(counts, key=lambda k: counts[k])


def _stitch_fragments(
    fragments: list[list[dict[str, Any]]],
) -> list[list[dict[str, Any]]]:
    """
    Join track fragments that continue each other across a track-id break.

    A fragment attaches to a chain when it starts shortly after the chain ends,
    near the chain's last position, with a compatible team label. When two
    chains compete for the same fragment without a clear distance winner, no
    stitch happens — a wrong join would swap player identities, which is worse
    than a missed one.
    """
    fragments = sorted(fragments, key=lambda c: c[0]["timestamp_s"])
    chains: list[list[dict[str, Any]]] = []

    for frag in fragments:
        t_start = float(frag[0]["timestamp_s"])
        fx, fy = float(frag[0]["x"]), float(frag[0]["y"])
        frag_team = _majority_team(frag)

        best: list[dict[str, Any]] | None = None
        best_d = float("inf")
        runner_up = float("inf")
        for chain in chains:
            last = chain[-1]
            gap = t_start - float(last["timestamp_s"])
            if not (0.0 < gap <= _STITCH_MAX_GAP_S):
                continue
            chain_team = _majority_team(chain[-min(len(chain), 15) :])
            if frag_team in ("A", "B") and chain_team in ("A", "B") and frag_team != chain_team:
                continue
            d = _dist(float(last["x"]), float(last["y"]), fx, fy)
            if d > min(_STITCH_BASE_DIST + _STITCH_SPEED * gap, _STITCH_MAX_DIST):
                continue
            if d < best_d:
                runner_up = best_d
                best, best_d = chain, d
            else:
                runner_up = min(runner_up, d)

        if best is not None and runner_up - best_d >= _STITCH_AMBIGUITY_MARGIN:
            best.extend(frag)
        else:
            chains.append(list(frag))

    return chains


def build_segments(
    rows: list[dict[str, Any]],
    max_gap_s: float = _MAX_GAP_S,
    min_duration_s: float = _MIN_SEGMENT_S,
    min_points: int = _MIN_SEGMENT_POINTS,
    smooth_window: int = _SMOOTH_WINDOW,
    stitch: bool = True,
) -> list[TrackSegment]:
    """
    Convert raw per-frame player rows into smoothed track segments.

    Tracks are split at detection gaps > max_gap_s (a re-used track_id after a
    long gap is usually a different player), then fragments of *different*
    track ids that continue each other are stitched back together — ByteTrack
    re-issues ids constantly, and plays regularly span such breaks.
    The per-frame team label flickers, so each segment gets the majority label.
    Velocities are derived from the smoothed positions because the velocity
    columns in DuckDB are unpopulated.
    """
    by_track: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        by_track.setdefault(int(row["track_id"]), []).append(row)

    # Step 1: contiguous fragments per track id (split at time gaps).
    # Short fragments are kept — they may complete a chain when stitched.
    fragments: list[list[dict[str, Any]]] = []
    for track_rows in by_track.values():
        track_rows.sort(key=lambda r: r["frame_id"])
        chunks: list[list[dict[str, Any]]] = [[track_rows[0]]]
        for prev, cur in pairwise(track_rows):
            if cur["timestamp_s"] - prev["timestamp_s"] > max_gap_s:
                chunks.append([])
            chunks[-1].append(cur)
        fragments.extend(chunks)

    # Step 2: stitch fragments across track-id breaks
    chains = _stitch_fragments(fragments) if stitch else fragments

    # Step 3: smooth, derive velocities, majority-vote the team
    segments: list[TrackSegment] = []
    for chunk in chains:
        if len(chunk) < min_points:
            continue
        duration = chunk[-1]["timestamp_s"] - chunk[0]["timestamp_s"]
        if duration < min_duration_s:
            continue

        times = [float(r["timestamp_s"]) for r in chunk]
        xs = _moving_average([float(r["x"]) for r in chunk], smooth_window)
        ys = _moving_average([float(r["y"]) for r in chunk], smooth_window)

        # Central-difference velocities
        n = len(times)
        vxs = [0.0] * n
        vys = [0.0] * n
        for i in range(n):
            lo = max(0, i - 1)
            hi = min(n - 1, i + 1)
            dt = times[hi] - times[lo]
            if dt > 0:
                vxs[i] = (xs[hi] - xs[lo]) / dt
                vys[i] = (ys[hi] - ys[lo]) / dt

        # The chain keeps the id of its most frequent constituent track
        id_counts: dict[int, int] = {}
        for r in chunk:
            id_counts[int(r["track_id"])] = id_counts.get(int(r["track_id"]), 0) + 1
        track_id = max(id_counts, key=lambda k: id_counts[k])

        segments.append(
            TrackSegment(
                track_id=track_id,
                team=_majority_team(chunk),
                frame_ids=[int(r["frame_id"]) for r in chunk],
                times=times,
                xs=xs,
                ys=ys,
                vxs=vxs,
                vys=vys,
            )
        )

    segments.sort(key=lambda s: s.start_s)
    return segments


def infer_attack_contexts(
    rows: list[dict[str, Any]],
    bin_s: float = _CONTEXT_BIN_S,
) -> list[AttackContext]:
    """
    Infer, per time bin, which goal is being attacked and by which team.

    Heuristic for positional attacks (works without has_ball, which is missing
    for most matches): both teams cluster near one goal; the defending team
    stands compactly at the circle, so the team with the *larger* mean distance
    to that goal is attacking.

    Only A/B rows enter the statistics — 'unknown' tracks are mostly referees
    and noise and would skew the cluster median.

    The mean-distance separation degrades as the attack pushes deep (attackers
    end up between the defenders), so an established context *persists* while
    the cluster stays near the same goal: weak or contradictory single bins
    keep the current attacking team, and switching the team at the same goal
    requires _CONTEXT_SWITCH_BINS consecutive bins of clear opposite evidence.
    Short holes between identical contexts (occlusion, zoom, failed homography
    for a moment) are bridged so detectors do not lose events at the seams.
    """
    if not rows:
        return []

    t_max = max(float(r["timestamp_s"]) for r in rows)
    n_bins = int(t_max / bin_s) + 1
    bins: list[dict[str, list[float]]] = [{"A": [], "B": []} for _ in range(n_bins)]
    for r in rows:
        team = str(r["team"])
        if team not in ("A", "B"):
            continue
        bins[int(float(r["timestamp_s"]) / bin_s)][team].append(float(r["x"]))

    # Per-bin verdicts: (goal_x, leading_team, margin) when the cluster sits
    # near one goal, else None.
    verdicts: list[tuple[float, str, float] | None] = []
    for b in bins:
        if len(b["A"]) < _CONTEXT_MIN_POINTS or len(b["B"]) < _CONTEXT_MIN_POINTS:
            verdicts.append(None)
            continue
        xs_all = sorted(b["A"] + b["B"])
        median_x = xs_all[len(xs_all) // 2]

        if median_x < _CONTEXT_GOAL_NEAR_X:
            goal_x = 0.0
        elif median_x > COURT_LENGTH - _CONTEXT_GOAL_NEAR_X:
            goal_x = COURT_LENGTH
        else:
            verdicts.append(None)  # transition / unclear
            continue

        mean_dist_a = sum(abs(x - goal_x) for x in b["A"]) / len(b["A"])
        mean_dist_b = sum(abs(x - goal_x) for x in b["B"]) / len(b["B"])
        leading = "A" if mean_dist_a > mean_dist_b else "B"
        verdicts.append((goal_x, leading, abs(mean_dist_a - mean_dist_b)))

    # Persistence pass: assign each bin an effective (goal, team) or None
    contexts: list[AttackContext] = []
    current: tuple[float, str] | None = None
    opposite_streak = 0

    def _append(i: int, goal_x: float, team: str) -> None:
        last = contexts[-1] if contexts else None
        if (
            last is not None
            and last.goal_x == goal_x
            and last.attacking_team == team
            and i * bin_s - last.end_s <= _CONTEXT_MAX_HOLE_S
        ):
            last.end_s = (i + 1) * bin_s
        else:
            contexts.append(
                AttackContext(
                    start_s=i * bin_s, end_s=(i + 1) * bin_s, goal_x=goal_x, attacking_team=team
                )
            )

    for i, verdict in enumerate(verdicts):
        if verdict is None:
            # Cluster dissolved or moved — the attack is over
            current = None
            opposite_streak = 0
            continue

        goal_x, leading, margin = verdict
        strong = margin >= _CONTEXT_MIN_MARGIN

        if current is not None and current[0] == goal_x:
            if strong and leading != current[1]:
                opposite_streak += 1
                if opposite_streak >= _CONTEXT_SWITCH_BINS:
                    current = (goal_x, leading)
                    opposite_streak = 0
            else:
                opposite_streak = 0
            _append(i, current[0], current[1])
        elif strong:
            current = (goal_x, leading)
            opposite_streak = 0
            _append(i, goal_x, leading)
        else:
            current = None  # weak evidence at a new goal opens nothing

    return contexts


def context_at(contexts: list[AttackContext], t: float) -> AttackContext | None:
    """Return the attack context covering time t, or None."""
    for ctx in contexts:
        if ctx.start_s <= t < ctx.end_s:
            return ctx
    return None


def _frame_positions(
    rows: list[dict[str, Any]],
) -> dict[int, dict[str, list[tuple[float, float]]]]:
    """Index raw rows as frame_id → team → [(x, y), ...] for defender lookups."""
    index: dict[int, dict[str, list[tuple[float, float]]]] = {}
    for r in rows:
        team = str(r["team"])
        if team not in ("A", "B"):
            continue
        index.setdefault(int(r["frame_id"]), {}).setdefault(team, []).append(
            (float(r["x"]), float(r["y"]))
        )
    return index


def _trajectory(
    seg: TrackSegment, t0: float, t1: float, max_points: int = _TRAJECTORY_MAX_POINTS
) -> list[list[float]]:
    """Downsampled [t, x, y] polyline of a segment within [t0, t1] (for the UI)."""
    pts = [
        [round(t, 2), round(x, 2), round(y, 2)]
        for t, x, y in zip(seg.times, seg.xs, seg.ys, strict=True)
        if t0 <= t <= t1
    ]
    if len(pts) <= max_points:
        return pts
    stride = (len(pts) - 1) / (max_points - 1)
    return [pts[round(i * stride)] for i in range(max_points)]


def _dist(x1: float, y1: float, x2: float, y2: float) -> float:
    return ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5


def _goal_dist(x: float, y: float, goal_x: float) -> float:
    """Distance to the goal centre (goals sit at mid-width)."""
    return _dist(x, y, goal_x, COURT_WIDTH / 2)


def _speed(seg: TrackSegment, k: int) -> float:
    return (seg.vxs[k] ** 2 + seg.vys[k] ** 2) ** 0.5


def _movement_start_idx(seg: TrackSegment, k: int) -> int:
    """
    Walk backwards from sample k to where the player was last standing.

    This is the event-boundary rule: a play starts when the involved player
    leaves his (near-)stationary position, not at the trigger moment itself.
    Capped at _MOVE_LOOKBACK_S so a player who never stops does not drag the
    event window arbitrarily far into the past.
    """
    i = k
    while (
        i > 0
        and seg.times[k] - seg.times[i - 1] <= _MOVE_LOOKBACK_S
        and _speed(seg, i - 1) >= _REST_SPEED
    ):
        i -= 1
    return i


def _movement_end_idx(seg: TrackSegment, k: int) -> int:
    """Walk forwards from sample k until the player comes to rest (see above)."""
    i = k
    n = len(seg.times)
    while (
        i < n - 1
        and seg.times[i + 1] - seg.times[k] <= _MOVE_LOOKBACK_S
        and _speed(seg, i + 1) >= _REST_SPEED
    ):
        i += 1
    return i


def _index_at_time(seg: TrackSegment, t: float) -> int:
    """Index of the first sample at or after time t (clamped to the segment)."""
    return min(bisect.bisect_left(seg.times, t), len(seg.times) - 1)


def _displacement(seg: TrackSegment, t0: float, t1: float) -> float:
    """Net positional displacement of a segment between two times."""
    i0 = _index_at_time(seg, t0)
    i1 = _index_at_time(seg, t1)
    return _dist(seg.xs[i0], seg.ys[i0], seg.xs[i1], seg.ys[i1])


# ---------------------------------------------------------------------------
# Detector 1 — Kreuzen / Positionstausch (lateral order swap)
# ---------------------------------------------------------------------------


def detect_kreuzen(
    segments: list[TrackSegment],
    contexts: list[AttackContext],
    frame_positions: dict[int, dict[str, list[tuple[float, float]]]],
) -> list[PlayEvent]:
    """
    Two same-team attackers swap their lateral (y) order in front of the goal.

    Covers both variants of a position swap:
      - scissors crossing: both sprint past each other (classic Kreuzen), and
      - sequential swap ("Hinterlaufen"): one player vacates his lane while a
        teammate runs in behind him — there is no moment where both move fast
        in opposite directions, so only one running player is required.

    A flip of the y-order only counts when the pair was clearly separated
    before AND after the flip (jitter rejection), passes within
    _SWAP_MAX_DIST, and sits in the backcourt band of the attacked goal.
    All flips of a pair are reported (a long possession can contain several),
    with a re-arm time so one swap is not double-counted.
    """
    events: list[PlayEvent] = []
    by_team: dict[str, list[TrackSegment]] = {}
    for seg in segments:
        if seg.team in ("A", "B"):
            by_team.setdefault(seg.team, []).append(seg)

    for team, team_segments in by_team.items():
        for a_idx in range(len(team_segments)):
            seg_a = team_segments[a_idx]
            for seg_b in team_segments[a_idx + 1 :]:
                if seg_a.track_id == seg_b.track_id:
                    continue
                # Quick temporal overlap rejection
                if (
                    min(seg_a.end_s, seg_b.end_s) - max(seg_a.start_s, seg_b.start_s)
                    < _SWAP_MIN_OVERLAP_S
                ):
                    continue

                common = sorted(set(seg_a.frame_ids) & set(seg_b.frame_ids))
                if len(common) < 2:
                    continue

                events.extend(
                    _find_position_swaps(seg_a, seg_b, common, contexts, frame_positions, team)
                )

    return events


def _find_position_swaps(
    seg_a: TrackSegment,
    seg_b: TrackSegment,
    common_frames: list[int],
    contexts: list[AttackContext],
    frame_positions: dict[int, dict[str, list[tuple[float, float]]]],
    team: str,
) -> list[PlayEvent]:
    """Scan the shared frames of two segments for valid lateral order swaps."""
    # Align the two segments on their shared frame grid
    samples: list[tuple[float, int, int, float, int]] = []  # (t, ia, ib, dy, frame)
    for frame_id in common_frames:
        ia = seg_a.index_of_frame(frame_id)
        ib = seg_b.index_of_frame(frame_id)
        assert ia is not None and ib is not None
        samples.append((seg_a.times[ia], ia, ib, seg_a.ys[ia] - seg_b.ys[ib], frame_id))

    events: list[PlayEvent] = []
    k = 1
    while k < len(samples):
        (t_prev, _, _, dy_prev, _) = samples[k - 1]
        (t_cur, ia, ib, dy_cur, frame_id) = samples[k]
        if dy_prev * dy_cur >= 0:
            k += 1
            continue

        t_cross = (t_prev + t_cur) / 2

        # Genuine order swap: clearly separated on both sides of the flip.
        # This is the jitter guard that allows relaxing the speed condition.
        sep_before = max(
            (
                abs(dy)
                for (t, _, _, dy, _) in samples
                if t_cross - _SWAP_CONTEXT_S <= t < t_cross and dy * dy_prev > 0
            ),
            default=0.0,
        )
        sep_after = max(
            (
                abs(dy)
                for (t, _, _, dy, _) in samples
                if t_cross < t <= t_cross + _SWAP_CONTEXT_S and dy * dy_cur > 0
            ),
            default=0.0,
        )
        if sep_before < _SWAP_MIN_SEPARATION or sep_after < _SWAP_MIN_SEPARATION:
            k += 1
            continue

        speed_a = _speed(seg_a, ia)
        speed_b = _speed(seg_b, ib)
        pair_dist = _dist(seg_a.xs[ia], seg_a.ys[ia], seg_b.xs[ib], seg_b.ys[ib])
        if max(speed_a, speed_b) < _SWAP_MIN_SPEED or pair_dist > _SWAP_MAX_DIST:
            k += 1
            continue

        goal_x = _swap_goal(
            seg_a, seg_b, ia, ib, t_cross, frame_id, contexts, frame_positions, team
        )
        if goal_x is None:
            k += 1
            continue

        # Event boundaries from the players' movement phases (when the first
        # involved player started moving / the last one came to rest), capped
        # around the flip so endless runners don't stretch the window.
        t0 = min(
            seg_a.times[_movement_start_idx(seg_a, ia)], seg_b.times[_movement_start_idx(seg_b, ib)]
        )
        t1 = max(
            seg_a.times[_movement_end_idx(seg_a, ia)], seg_b.times[_movement_end_idx(seg_b, ib)]
        )
        t0 = max(t0, t_cross - _SWAP_MAX_WINDOW_S)
        t1 = min(t1, t_cross + _SWAP_MAX_WINDOW_S)

        # Both must actually move — running past a standing teammate flips the
        # order too, but nobody swapped positions.
        if min(_displacement(seg_a, t0, t1), _displacement(seg_b, t0, t1)) < _SWAP_MIN_PARTNER_MOVE:
            k += 1
            continue

        scissors = (
            min(speed_a, speed_b) >= _SWAP_SCISSORS_SPEED
            and seg_a.vys[ia] * seg_b.vys[ib] < 0
            and pair_dist <= _SWAP_SCISSORS_DIST
        )
        confidence = min(
            0.95,
            0.45
            + 0.2 * min(1.0, max(speed_a, speed_b) / 3.0)
            + 0.15 * min(1.0, min(sep_before, sep_after) / 3.0)
            + (0.15 if scissors else 0.0),
        )
        frames_in = [f for f in common_frames if _frame_time(seg_a, f, t0, t1)]
        events.append(
            PlayEvent(
                play_type="kreuzen",
                team=team,
                start_frame=frames_in[0] if frames_in else frame_id,
                end_frame=frames_in[-1] if frames_in else frame_id,
                start_time_s=round(t0, 3),
                end_time_s=round(t1, 3),
                confidence=round(confidence, 3),
                track_ids=[seg_a.track_id, seg_b.track_id],
                details={
                    "goal_x": goal_x,
                    "cross_time_s": round(t_cross, 2),
                    "pair_distance_m": round(pair_dist, 2),
                    "variante": "kreuzen" if scissors else "positionswechsel",
                    "tracks": [
                        {"track_id": seg_a.track_id, "points": _trajectory(seg_a, t0, t1)},
                        {"track_id": seg_b.track_id, "points": _trajectory(seg_b, t0, t1)},
                    ],
                },
            )
        )

        # Re-arm: skip flips caused by y-jitter right after this swap
        while k < len(samples) and samples[k][0] < t_cross + _SWAP_REARM_S:
            k += 1

    return events


def _frame_time(seg: TrackSegment, frame_id: int, t0: float, t1: float) -> bool:
    idx = seg.index_of_frame(frame_id)
    return idx is not None and t0 <= seg.times[idx] <= t1


def _swap_goal(
    seg_a: TrackSegment,
    seg_b: TrackSegment,
    i: int,
    j: int,
    t_cross: float,
    frame_id: int,
    contexts: list[AttackContext],
    frame_positions: dict[int, dict[str, list[tuple[float, float]]]],
    team: str,
) -> float | None:
    """
    Validate the attack zone and return the attacked goal x, or None.

    Preferred source is the inferred attack context. Without one (sparse data),
    fall back to the nearest goal and require a defensive screen: at least
    _SWAP_MIN_DEFENDERS opponents closer to that goal than the crossers.
    """
    ctx = context_at(contexts, t_cross)
    if ctx is not None:
        if ctx.attacking_team != team:
            return None
        goal_x = ctx.goal_x
    else:
        mid_x = (seg_a.xs[i] + seg_b.xs[j]) / 2
        goal_x = 0.0 if mid_x < COURT_LENGTH / 2 else COURT_LENGTH

    dist_a = _goal_dist(seg_a.xs[i], seg_a.ys[i], goal_x)
    dist_b = _goal_dist(seg_b.xs[j], seg_b.ys[j], goal_x)
    if not (
        _SWAP_ZONE_MIN <= dist_a <= _SWAP_ZONE_MAX and _SWAP_ZONE_MIN <= dist_b <= _SWAP_ZONE_MAX
    ):
        return None

    if ctx is None:
        opponent = "B" if team == "A" else "A"
        opponents = frame_positions.get(frame_id, {}).get(opponent, [])
        screen = sum(1 for x, y in opponents if _goal_dist(x, y, goal_x) < min(dist_a, dist_b))
        if screen < _SWAP_MIN_DEFENDERS:
            return None

    return goal_x


# ---------------------------------------------------------------------------
# Detector 2 — Einläufer (run-in towards the circle)
# ---------------------------------------------------------------------------


def detect_einlaeufer(
    segments: list[TrackSegment],
    contexts: list[AttackContext],
) -> list[PlayEvent]:
    """
    An attacker leaves the backcourt and runs in towards the 6m circle.

    Pattern on a single segment: distance to the attacked goal drops from
    > _RUNIN_START_DIST to < _RUNIN_END_DIST within _RUNIN_MAX_RUN_S, mostly
    monotonically, and the player then stays near the circle (hold check).
    Requires an attack context so a fast-break sprint is not mislabelled.
    """
    events: list[PlayEvent] = []

    for seg in segments:
        if seg.team not in ("A", "B"):
            continue

        i = 0
        n = len(seg.times)
        while i < n:
            ctx = context_at(contexts, seg.times[i])
            if ctx is None or ctx.attacking_team != seg.team:
                i += 1
                continue

            d_i = _goal_dist(seg.xs[i], seg.ys[i], ctx.goal_x)
            if not (_RUNIN_START_DIST < d_i <= _RUNIN_MAX_START_DIST):
                i += 1
                continue

            event_end = _find_runin(seg, i, ctx.goal_x)
            if event_end is None:
                i += 1
                continue

            j, hold_end_idx = event_end
            d_j = _goal_dist(seg.xs[j], seg.ys[j], ctx.goal_x)
            confidence = min(
                0.95,
                0.5
                + 0.2 * min(1.0, (d_i - d_j) / 6.0)
                + 0.2 * min(1.0, (_RUNIN_END_DIST - d_j) / 3.0),
            )
            # Start when the player left his standing position, not when he
            # happened to clear the backcourt distance threshold.
            start_idx = _movement_start_idx(seg, i)
            t0, t1 = seg.times[start_idx], seg.times[hold_end_idx]
            events.append(
                PlayEvent(
                    play_type="einlaeufer",
                    team=seg.team,
                    start_frame=seg.frame_ids[start_idx],
                    end_frame=seg.frame_ids[hold_end_idx],
                    start_time_s=round(t0, 3),
                    end_time_s=round(t1, 3),
                    confidence=round(max(0.3, confidence), 3),
                    track_ids=[seg.track_id],
                    details={
                        "goal_x": ctx.goal_x,
                        "start_dist_m": round(d_i, 2),
                        "end_dist_m": round(d_j, 2),
                        "tracks": [{"track_id": seg.track_id, "points": _trajectory(seg, t0, t1)}],
                    },
                )
            )
            i = hold_end_idx + 1  # continue after this event, no overlaps per segment

    return events


def _find_runin(seg: TrackSegment, i: int, goal_x: float) -> tuple[int, int] | None:
    """
    Find a valid run-in starting at index i. Returns (arrival_idx, hold_end_idx).
    """
    n = len(seg.times)
    dists = [_goal_dist(seg.xs[k], seg.ys[k], goal_x) for k in range(i, n)]

    for off in range(1, len(dists)):
        j = i + off
        if seg.times[j] - seg.times[i] > _RUNIN_MAX_RUN_S:
            break
        if dists[off] >= _RUNIN_END_DIST:
            continue
        if dists[0] - dists[off] < _RUNIN_MIN_APPROACH:
            continue

        # Mostly monotonic approach
        decreasing = sum(1 for k in range(off) if dists[k + 1] <= dists[k] + 0.15)
        if decreasing / off < _RUNIN_MONOTONIC_FRAC:
            continue

        # Anchor the hold check at the *deepest* point of the run, not the first
        # sample below the threshold — otherwise a feint (run in, turn straight
        # back out) still has enough shallow samples to pass.
        deepest = j
        deepest_dist = dists[off]
        for k in range(j + 1, n):
            if seg.times[k] - seg.times[j] > _RUNIN_HOLD_S:
                break
            d_k = _goal_dist(seg.xs[k], seg.ys[k], goal_x)
            if d_k < deepest_dist:
                deepest = k
                deepest_dist = d_k

        # Hold check: stays near the circle for _RUNIN_HOLD_S (or to segment end,
        # requiring at least half the hold window of evidence)
        hold_end_idx = deepest
        held_until = seg.times[deepest]
        ok = True
        for k in range(deepest + 1, n):
            if seg.times[k] - seg.times[deepest] > _RUNIN_HOLD_S:
                break
            if _goal_dist(seg.xs[k], seg.ys[k], goal_x) > _RUNIN_HOLD_DIST:
                ok = False
                break
            hold_end_idx = k
            held_until = seg.times[k]
        if not ok or held_until - seg.times[deepest] < _RUNIN_HOLD_S / 2:
            continue

        return j, hold_end_idx

    return None


# ---------------------------------------------------------------------------
# Detector 3 — Parallelstoß (parallel thrust)
# ---------------------------------------------------------------------------


def detect_parallelstoss(
    segments: list[TrackSegment],
    contexts: list[AttackContext],
) -> list[PlayEvent]:
    """
    Two laterally adjacent backcourt attackers push towards the goal together.

    Pattern: both players start in the backcourt band, keep their lateral
    order (no swap — that would be Kreuzen), and each gains at least
    _PUSH_MIN_APPROACH towards the attacked goal within _PUSH_WINDOW_S while
    actually running. Requires an attack context (attacking team + goal).
    Three players pushing produce multiple pair events; merge_events collapses
    them into one event with all involved tracks.
    """
    events: list[PlayEvent] = []
    by_team: dict[str, list[TrackSegment]] = {}
    for seg in segments:
        if seg.team in ("A", "B"):
            by_team.setdefault(seg.team, []).append(seg)

    for team, team_segments in by_team.items():
        for a_idx in range(len(team_segments)):
            seg_a = team_segments[a_idx]
            for seg_b in team_segments[a_idx + 1 :]:
                if seg_a.track_id == seg_b.track_id:
                    continue
                if (
                    min(seg_a.end_s, seg_b.end_s) - max(seg_a.start_s, seg_b.start_s)
                    < _PUSH_MIN_OVERLAP_S
                ):
                    continue

                common = sorted(set(seg_a.frame_ids) & set(seg_b.frame_ids))
                if len(common) < _MIN_SEGMENT_POINTS:
                    continue

                events.extend(_find_pushes(seg_a, seg_b, common, contexts, team))

    return events


def _find_pushes(
    seg_a: TrackSegment,
    seg_b: TrackSegment,
    common_frames: list[int],
    contexts: list[AttackContext],
    team: str,
) -> list[PlayEvent]:
    """Scan the shared frames of two segments for simultaneous goal-ward pushes."""
    aligned: list[tuple[float, int, int]] = []  # (t, ia, ib)
    for frame_id in common_frames:
        ia = seg_a.index_of_frame(frame_id)
        ib = seg_b.index_of_frame(frame_id)
        assert ia is not None and ib is not None
        aligned.append((seg_a.times[ia], ia, ib))

    events: list[PlayEvent] = []
    k = 0
    while k < len(aligned):
        t_k, ia0, ib0 = aligned[k]
        ctx = context_at(contexts, t_k)
        if ctx is None or ctx.attacking_team != team:
            k += 1
            continue

        d_a0 = _goal_dist(seg_a.xs[ia0], seg_a.ys[ia0], ctx.goal_x)
        d_b0 = _goal_dist(seg_b.xs[ib0], seg_b.ys[ib0], ctx.goal_x)
        dy0 = seg_a.ys[ia0] - seg_b.ys[ib0]
        if not (
            _PUSH_ZONE_MIN_START <= d_a0 <= _PUSH_ZONE_MAX
            and _PUSH_ZONE_MIN_START <= d_b0 <= _PUSH_ZONE_MAX
            and _PUSH_LATERAL_MIN <= abs(dy0) <= _PUSH_LATERAL_MAX
        ):
            k += 1
            continue

        # Scan forward: do both players gain depth within the push window?
        hit: tuple[int, int, int, float] | None = None  # (m, ja, jb, min_approach)
        max_speed_a = 0.0
        max_speed_b = 0.0
        m = k + 1
        while m < len(aligned) and aligned[m][0] - t_k <= _PUSH_WINDOW_S:
            _, ja, jb = aligned[m]
            dy_m = seg_a.ys[ja] - seg_b.ys[jb]
            if dy_m * dy0 <= 0:
                break  # order swap → Kreuzen territory, not a parallel thrust
            max_speed_a = max(max_speed_a, _speed(seg_a, ja))
            max_speed_b = max(max_speed_b, _speed(seg_b, jb))
            approach_a = d_a0 - _goal_dist(seg_a.xs[ja], seg_a.ys[ja], ctx.goal_x)
            approach_b = d_b0 - _goal_dist(seg_b.xs[jb], seg_b.ys[jb], ctx.goal_x)
            if (
                min(approach_a, approach_b) >= _PUSH_MIN_APPROACH
                and min(max_speed_a, max_speed_b) >= _PUSH_MIN_SPEED
            ):
                hit = (m, ja, jb, min(approach_a, approach_b))
            m += 1

        if hit is None:
            k += 1
            continue

        m, ja, jb, approach = hit
        t0 = min(
            seg_a.times[_movement_start_idx(seg_a, ja)],
            seg_b.times[_movement_start_idx(seg_b, jb)],
        )
        t0 = max(t0, t_k - _MOVE_LOOKBACK_S)
        t1 = max(
            seg_a.times[_movement_end_idx(seg_a, ja)],
            seg_b.times[_movement_end_idx(seg_b, jb)],
        )
        t1 = min(t1, aligned[m][0] + _MOVE_LOOKBACK_S)

        confidence = min(
            0.95,
            0.45
            + 0.2 * min(1.0, approach / 4.0)
            + 0.15 * min(1.0, min(max_speed_a, max_speed_b) / 3.0),
        )
        frames_in = [f for f in common_frames if _frame_time(seg_a, f, t0, t1)]
        events.append(
            PlayEvent(
                play_type="parallelstoss",
                team=team,
                start_frame=frames_in[0] if frames_in else common_frames[k],
                end_frame=frames_in[-1] if frames_in else common_frames[m],
                start_time_s=round(t0, 3),
                end_time_s=round(t1, 3),
                confidence=round(confidence, 3),
                track_ids=[seg_a.track_id, seg_b.track_id],
                details={
                    "goal_x": ctx.goal_x,
                    "approach_m": round(approach, 2),
                    "tracks": [
                        {"track_id": seg_a.track_id, "points": _trajectory(seg_a, t0, t1)},
                        {"track_id": seg_b.track_id, "points": _trajectory(seg_b, t0, t1)},
                    ],
                },
            )
        )

        # Re-arm after the push so the same thrust is not re-reported
        while k < len(aligned) and aligned[k][0] < aligned[m][0] + _PUSH_REARM_S:
            k += 1

    return events


# ---------------------------------------------------------------------------
# Detector 4 — Tempogegenstoß (fast break)
# ---------------------------------------------------------------------------


def detect_tempogegenstoss(
    rows: list[dict[str, Any]],
    contexts: list[AttackContext],
) -> list[PlayEvent]:
    """
    The team centroid sprints from its own half into the opponent half.

    Works on per-frame team centroids instead of individual tracks, which makes
    it immune to track fragmentation — the most robust of the three detectors.

    During a fast break *both* centroids move fast (the defence sprints back),
    so centroid motion alone cannot tell counter from retreat. The attack
    context shortly after the run disambiguates: the countering team is the
    attacking team at the goal it ran towards, the retreating team is not.
    """
    # Build per-team centroid series on the frame grid
    per_frame: dict[int, dict[str, list[tuple[float, float]]]] = {}
    frame_times: dict[int, float] = {}
    for r in rows:
        team = str(r["team"])
        if team not in ("A", "B"):
            continue
        fid = int(r["frame_id"])
        per_frame.setdefault(fid, {}).setdefault(team, []).append((float(r["x"]), float(r["y"])))
        frame_times[fid] = float(r["timestamp_s"])

    events: list[PlayEvent] = []
    for team in ("A", "B"):
        frames: list[int] = []
        times: list[float] = []
        cxs: list[float] = []
        for fid in sorted(per_frame):
            positions = per_frame[fid].get(team, [])
            if len(positions) >= _BREAK_MIN_PLAYERS:
                frames.append(fid)
                times.append(frame_times[fid])
                cxs.append(sum(x for x, _ in positions) / len(positions))

        if len(cxs) < _MIN_SEGMENT_POINTS:
            continue
        cxs = _moving_average(cxs, _SMOOTH_WINDOW)
        events.extend(_centroid_runs(team, frames, times, cxs, contexts))

    return events


def _is_attacking_after(
    contexts: list[AttackContext], team: str, goal_x: float, t_end: float
) -> bool:
    """
    True if the team holds the attack at goal_x in a context shortly after t_end.

    A counter ends near the attacked goal; the next positional context there
    must name this team as the attacker. Without any context (e.g. the counter
    ends in an immediate shot and turnover) the run is kept — the geometric
    predicate alone already rules out most non-break movement.
    """
    for ctx in contexts:
        if ctx.end_s <= t_end or ctx.start_s > t_end + _BREAK_CONTEXT_LOOKAHEAD_S:
            continue
        return ctx.attacking_team == team and ctx.goal_x == goal_x
    return True


def _centroid_runs(
    team: str,
    frames: list[int],
    times: list[float],
    cxs: list[float],
    contexts: list[AttackContext],
) -> list[PlayEvent]:
    """Extract sustained high-speed centroid runs for one team."""
    events: list[PlayEvent] = []
    n = len(times)
    i = 0
    while i < n - 1:
        for direction in (1.0, -1.0):
            run_end = i
            last_fast = i
            # Extend the run while signed speed stays high (brief dips allowed)
            for k in range(i + 1, n):
                dt = times[k] - times[k - 1]
                if dt <= 0 or dt > _BREAK_DIP_TOLERANCE_S * 2:
                    break
                speed = direction * (cxs[k] - cxs[k - 1]) / dt
                if speed >= _BREAK_MIN_SPEED:
                    run_end = k
                    last_fast = k
                elif times[k] - times[last_fast] > _BREAK_DIP_TOLERANCE_S:
                    break

            displacement = direction * (cxs[run_end] - cxs[i])
            duration = times[run_end] - times[i]
            goal_x = COURT_LENGTH if direction > 0 else 0.0
            start_own_half = (
                cxs[i] < _BREAK_START_OWN_HALF_X
                if direction > 0
                else cxs[i] > _BREAK_START_OWN_HALF_X
            )
            crossed_mid = (
                cxs[run_end] > _BREAK_START_OWN_HALF_X + _BREAK_CROSS_MARGIN
                if direction > 0
                else cxs[run_end] < _BREAK_START_OWN_HALF_X - _BREAK_CROSS_MARGIN
            )

            if (
                displacement >= _BREAK_MIN_DISPLACEMENT
                and 0 < duration <= _BREAK_MAX_DURATION_S
                and start_own_half
                and crossed_mid
                and displacement / duration <= _BREAK_MAX_SPEED
                and _is_attacking_after(contexts, team, goal_x, times[run_end])
            ):
                mean_speed = displacement / duration
                confidence = min(
                    0.95, 0.5 + 0.2 * min(1.0, mean_speed / 4.0) + 0.2 * (displacement / 30.0)
                )
                centroid_points = [
                    [round(times[k], 2), round(cxs[k], 2), round(COURT_WIDTH / 2, 2)]
                    for k in range(i, run_end + 1)
                ]
                if len(centroid_points) > _TRAJECTORY_MAX_POINTS:
                    stride = (len(centroid_points) - 1) / (_TRAJECTORY_MAX_POINTS - 1)
                    centroid_points = [
                        centroid_points[round(s * stride)] for s in range(_TRAJECTORY_MAX_POINTS)
                    ]
                events.append(
                    PlayEvent(
                        play_type="tempogegenstoss",
                        team=team,
                        start_frame=frames[i],
                        end_frame=frames[run_end],
                        start_time_s=round(times[i], 3),
                        end_time_s=round(times[run_end], 3),
                        confidence=round(confidence, 3),
                        track_ids=[],
                        details={
                            "goal_x": goal_x,
                            "distance_m": round(displacement, 1),
                            "mean_speed_ms": round(mean_speed, 2),
                            # track_id -1 marks the team centroid for the UI
                            "tracks": [{"track_id": -1, "points": centroid_points}],
                        },
                    )
                )
                i = run_end  # skip past this run
                break
        i += 1

    return events


# ---------------------------------------------------------------------------
# Post-processing + top-level entry point
# ---------------------------------------------------------------------------


def merge_events(events: list[PlayEvent], merge_gap_s: float = _MERGE_GAP_S) -> list[PlayEvent]:
    """
    Merge same-type, same-team events that overlap or nearly touch.

    Fragmented tracks produce duplicate detections of the same real play (the
    same two players may appear under several track_id pairs); merging by time
    keeps one event per real-world occurrence.
    """
    events = sorted(events, key=lambda e: (e.play_type, e.team, e.start_time_s))
    merged: list[PlayEvent] = []
    for event in events:
        last = merged[-1] if merged else None
        if (
            last is not None
            and last.play_type == event.play_type
            and last.team == event.team
            and event.start_time_s <= last.end_time_s + merge_gap_s
        ):
            last.end_time_s = max(last.end_time_s, event.end_time_s)
            last.end_frame = max(last.end_frame, event.end_frame)
            # Keep the higher-confidence event's details (trajectories)
            if event.confidence > last.confidence:
                last.details = event.details
            last.confidence = max(last.confidence, event.confidence)
            for tid in event.track_ids:
                if tid not in last.track_ids:
                    last.track_ids.append(tid)
        else:
            merged.append(event)

    merged.sort(key=lambda e: e.start_time_s)
    return merged


def build_attack_sequences(
    rows: list[dict[str, Any]],
    contexts: list[AttackContext],
    events: list[PlayEvent],
    goal_times_s: list[float] | None,
) -> list[AttackSequence]:
    """
    Group attack contexts into attack sequences (Angriffe) and attribute
    outcomes and events to them.

    Each sufficiently long context span becomes one sequence. A goal whose
    scoreboard timestamp falls inside the window (plus a grace period for the
    shot/celebration delay) marks the sequence as successful — deliberately
    without mapping home/away to team A/B, because during an attack only the
    attacking team realistically scores. goal_times_s=None means no scoreboard
    data exists; outcomes are then 'unknown' instead of a misleading 'no_goal'.

    Side effect: sets event.sequence_id on the events that fall into a
    sequence (the writer persists events and sequences in the same order).
    """
    frame_times = sorted({(float(r["timestamp_s"]), int(r["frame_id"])) for r in rows})
    times_only = [t for t, _ in frame_times]

    def _frame_at(t: float) -> int:
        i = min(bisect.bisect_left(times_only, t), len(frame_times) - 1)
        return frame_times[i][1]

    sequences: list[AttackSequence] = []
    for ctx in contexts:
        if ctx.end_s - ctx.start_s < _SEQ_MIN_DURATION_S:
            continue

        sequence_id = len(sequences)
        event_count = 0
        for event in events:
            if (
                event.team == ctx.attacking_team
                and event.end_time_s >= ctx.start_s - _SEQ_EVENT_TOLERANCE_S
                and event.start_time_s <= ctx.end_s
                and event.sequence_id is None
            ):
                event.sequence_id = sequence_id
                event_count += 1

        if goal_times_s is None:
            outcome = "unknown"
        elif any(ctx.start_s <= g <= ctx.end_s + _SEQ_GOAL_GRACE_S for g in goal_times_s):
            outcome = "goal"
        else:
            outcome = "no_goal"

        sequences.append(
            AttackSequence(
                sequence_id=sequence_id,
                team=ctx.attacking_team,
                goal_x=ctx.goal_x,
                start_frame=_frame_at(ctx.start_s),
                end_frame=_frame_at(ctx.end_s),
                start_time_s=round(ctx.start_s, 3),
                end_time_s=round(ctx.end_s, 3),
                outcome=outcome,
                event_count=event_count,
            )
        )

    return sequences


def analyze_match(
    rows: list[dict[str, Any]],
    goal_times_s: list[float] | None = None,
) -> tuple[list[PlayEvent], list[AttackSequence]]:
    """
    Run all play detectors and attack-sequence grouping on one match.

    Args:
        rows:         per-player per-frame dicts with keys
                      frame_id, timestamp_s, track_id, team, x, y
                      (court-mapped positions only — filter court_x in SQL)
        goal_times_s: scoreboard goal timestamps for outcome attribution,
                      or None when no scoreboard data exists

    Returns:
        (events, sequences) — events merged and time-ordered with
        sequence_id set; the writer assigns event_id by list position.
    """
    if not rows:
        return [], []

    segments = build_segments(rows)
    contexts = infer_attack_contexts(rows)
    frame_positions = _frame_positions(rows)

    events: list[PlayEvent] = []
    events.extend(detect_kreuzen(segments, contexts, frame_positions))
    events.extend(detect_einlaeufer(segments, contexts))
    events.extend(detect_parallelstoss(segments, contexts))
    events.extend(detect_tempogegenstoss(rows, contexts))

    # Role-based detectors (Rollenmodell) — second evidence source for swaps
    # and run-ins; merge_events deduplicates overlap with the geometric finds.
    # Imported lazily: roles.py imports this module for the shared types.
    from ml.analysis import roles as role_detector

    events.extend(role_detector.detect_role_events(segments, contexts))

    merged = merge_events(events)
    sequences = build_attack_sequences(rows, contexts, merged, goal_times_s)
    return merged, sequences


def detect_plays(
    rows: list[dict[str, Any]],
) -> list[PlayEvent]:
    """Backwards-compatible wrapper: events only (see analyze_match)."""
    return analyze_match(rows)[0]
