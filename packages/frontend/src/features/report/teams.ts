import type { MatchMeta } from '@/shared/api'

export type TeamName = (team: string) => string

/**
 * The bucket for a track the team classifier did not place.
 *
 * The raw `team` column arrives as `null` or as the classifier's own
 * `"unknown"`, and both mean the same thing; `U` is what the normalised `team`
 * of every other endpoint calls it.
 */
export const UNASSIGNED = 'U'

/**
 * A raw `team` value as one bucket, for the two endpoints that report the column
 * unnormalised — `player_stats[].team` and `available_track_ids[].team`.
 *
 * Anything else the classifier writes keeps its own bucket: a team id it invents
 * is shown as itself rather than collapsed into "unassigned".
 */
export function teamBucket(team: string | null): string {
  const raw = team?.trim().toUpperCase() ?? ''

  return raw === '' || raw === 'UNKNOWN' ? UNASSIGNED : raw
}

/** The buckets present in these rows, unassigned last so it reads as the rest. */
export function teamBuckets(teams: readonly (string | null)[]): string[] {
  const buckets = [...new Set(teams.map(teamBucket))]

  return buckets.sort((a, b) => {
    if (a === UNASSIGNED) return 1
    if (b === UNASSIGNED) return -1

    return a < b ? -1 : a > b ? 1 : 0
  })
}

/**
 * What to call a team the backend named `"A"` or `"B"`: the trainer's name for
 * it, if they have set one.
 *
 * `fallback` is `useBackendLabel`'s `team` group, so a value the classifier
 * invents — `"unknown"` today, whatever the GCN emits later — still renders as
 * itself rather than disappearing.
 */
export function teamNamer(
  match: Pick<MatchMeta, 'team_a_name' | 'team_b_name'>,
  fallback: TeamName,
): TeamName {
  const named: Record<string, string | null> = {
    A: match.team_a_name,
    B: match.team_b_name,
  }

  return (team) => named[team.toUpperCase()]?.trim() || fallback(team)
}
