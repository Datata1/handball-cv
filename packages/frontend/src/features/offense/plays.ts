import type { PlayEvent, PlaySummary } from '@/shared/api'

/**
 * `play-summary` as a table, without ever naming a play type.
 *
 * The detector's label set is an open string column and is due to change with
 * the GCN + LSTM work, so nothing here may enumerate play types, describe them,
 * or order them by a list of its own. Counts decide the order and the backend's
 * own string is the label — the legacy section iterated a four-entry frontend
 * dictionary instead, so a fifth type rendered nothing at all.
 */

export interface PlayTypeTeam {
  team: string
  count: number
}

export interface PlayTypeRow {
  playType: string
  /** Events of this type, both teams together. */
  total: number
  /** Of all detected plays, `0`–`1`. */
  share: number
  /** Who ran it, most often first. */
  teams: PlayTypeTeam[]
  /** Attacks containing this play whose outcome the scoreboard settled. */
  attacksRated: number
  attacksGoal: number
  /**
   * `attacksGoal / attacksRated` over both teams, or `null` when nothing was
   * rated — which is not the same as none of them scoring.
   */
  successRate: number | null
  /** The per-team confidences, weighted by how many events each covers. */
  avgConfidence: number
}

/** Most first, and ties broken on the label so one response has one order. */
function byCountThenLabel(
  [labelA, a]: readonly [string, number],
  [labelB, b]: readonly [string, number],
): number {
  return b - a || (labelA < labelB ? -1 : labelA > labelB ? 1 : 0)
}

/**
 * One row per play type, most-detected first.
 *
 * The response is grouped by `(play_type, team)`; a trainer asks about the move,
 * so the teams are folded back together here and kept as a breakdown.
 */
export function playTypeTable(summaries: readonly PlaySummary[]): PlayTypeRow[] {
  const grouped = new Map<string, PlaySummary[]>()

  for (const summary of summaries) {
    const rows = grouped.get(summary.play_type)
    if (rows) rows.push(summary)
    else grouped.set(summary.play_type, [summary])
  }

  const detected = summaries.reduce((sum, summary) => sum + summary.count, 0)

  const rows = [...grouped].map(([playType, group]): PlayTypeRow => {
    const total = group.reduce((sum, row) => sum + row.count, 0)
    const attacksRated = group.reduce((sum, row) => sum + row.attacks_rated, 0)
    const attacksGoal = group.reduce((sum, row) => sum + row.attacks_goal, 0)
    const confidence = group.reduce(
      (sum, row) => sum + row.avg_confidence * row.count,
      0,
    )

    return {
      playType,
      total,
      share: detected > 0 ? total / detected : 0,
      teams: group
        .map((row) => [row.team, row.count] as const)
        .sort(byCountThenLabel)
        .map(([team, count]) => ({ team, count })),
      attacksRated,
      attacksGoal,
      // Guarded rather than defaulted to 0: an unrated play type has no success
      // rate, and `0 %` would read as "never scored".
      successRate: attacksRated > 0 ? attacksGoal / attacksRated : null,
      avgConfidence: total > 0 ? confidence / total : 0,
    }
  })

  return rows.sort((a, b) =>
    byCountThenLabel([a.playType, a.total], [b.playType, b.total]),
  )
}

/**
 * The events a drill-in shows, oldest first.
 *
 * Filtered here rather than through the endpoint's own `?play_type`: the shell
 * has already loaded every play for the timeline, and a filtered request would
 * be a second cache entry describing rows the first one already holds.
 */
export function playsFor(
  plays: readonly PlayEvent[],
  filter: { playType?: string },
): PlayEvent[] {
  return plays
    .filter(
      (play) => filter.playType === undefined || play.play_type === filter.playType,
    )
    .sort((a, b) => a.start_time_s - b.start_time_s)
}

export function playDuration(play: PlayEvent): number {
  return Math.max(0, play.end_time_s - play.start_time_s)
}

/**
 * Whether the attack this play belongs to ended in a goal, as far as anyone
 * knows.
 *
 * `null` is genuinely unknown: it is what both "no attack sequence was linked"
 * and "this database predates attack sequences" look like, and the route that
 * serves them cannot tell either. Only `'goal'` is a goal; everything else is
 * the detector's own string.
 */
export function playOutcome(play: PlayEvent): string | null {
  return play.outcome?.trim() || null
}
