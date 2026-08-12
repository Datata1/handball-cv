import type { PlayerStat } from '@/shared/api'

/**
 * The tracking diagnostics of `/stats`, ordered and bucketed for the table.
 *
 * A row is a **track**, not a player: a camera cut, an occlusion or a
 * substitution ends one and starts another, so one player holds several and one
 * track can cover two players. Nothing in here tries to stitch them together.
 */

/** `player_stats` is `ORDER BY frame_count DESC LIMIT 25` — the longest-lived tracks. */
export const TRACK_LIMIT = 25

/**
 * The bucket for a track the team classifier did not place. `player_stats.team`
 * is the raw column and SQL-nullable, so both `null` and the classifier's own
 * `"unknown"` arrive here and mean the same thing; `U` is what the normalised
 * `team` of every other endpoint calls it.
 */
export const UNASSIGNED = 'U'

/** Also the table's column ids and the values `?sort=` may take. */
export const TRACK_SORT_KEYS = [
  'track',
  'team',
  'frames',
  'confidence',
  'distance',
] as const

export type TrackSortKey = (typeof TRACK_SORT_KEYS)[number]

/** The two values `aria-sort` takes, so nothing has to translate them. */
export type SortDirection = 'ascending' | 'descending'

export type TrackSort = { key: TrackSortKey; direction: SortDirection }

export function isTrackSortKey(value: string): value is TrackSortKey {
  return TRACK_SORT_KEYS.some((key) => key === value)
}

/** The order the backend already sent the rows in. */
export const DEFAULT_TRACK_SORT: TrackSort = { key: 'frames', direction: 'descending' }

/**
 * Anything the classifier writes keeps its own bucket — a team id it invents is
 * shown as itself rather than collapsed into "unassigned".
 */
export function teamBucket(team: string | null): string {
  const raw = team?.trim().toUpperCase() ?? ''

  return raw === '' || raw === 'UNKNOWN' ? UNASSIGNED : raw
}

/** The buckets present in these rows, unassigned last so it reads as the rest. */
export function teamBuckets(tracks: readonly PlayerStat[]): string[] {
  const buckets = [...new Set(tracks.map((track) => teamBucket(track.team)))]

  return buckets.sort((a, b) => {
    if (a === UNASSIGNED) return 1
    if (b === UNASSIGNED) return -1

    return a < b ? -1 : a > b ? 1 : 0
  })
}

export function filterTracks(
  tracks: readonly PlayerStat[],
  team: string | undefined,
): PlayerStat[] {
  if (team === undefined) return [...tracks]

  return tracks.filter((track) => teamBucket(track.team) === team)
}

const VALUE: Record<TrackSortKey, (track: PlayerStat) => number | string> = {
  track: (track) => track.track_id,
  team: (track) => teamBucket(track.team),
  frames: (track) => track.frame_count,
  confidence: (track) => track.avg_confidence_pct,
  distance: (track) => track.distance_m,
}

export function sortTracks(
  tracks: readonly PlayerStat[],
  { key, direction }: TrackSort,
): PlayerStat[] {
  const sign = direction === 'ascending' ? 1 : -1
  const value = VALUE[key]

  return [...tracks].sort((a, b) => {
    const difference = compare(value(a), value(b))

    // Ties fall back to the track id in both directions: the sort order has to
    // be the same list every time, or a re-render reshuffles equal rows.
    return difference === 0 ? a.track_id - b.track_id : sign * difference
  })
}

function compare(a: number | string, b: number | string): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b

  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

/**
 * What clicking a column header does: flip the column that is already sorted,
 * and otherwise start each column where its interesting end is — the longest
 * track, the biggest distance, but the first track id.
 */
export function nextSort(current: TrackSort, key: TrackSortKey): TrackSort {
  if (current.key === key) {
    return {
      key,
      direction: current.direction === 'ascending' ? 'descending' : 'ascending',
    }
  }

  return {
    key,
    direction: key === 'track' || key === 'team' ? 'ascending' : 'descending',
  }
}
