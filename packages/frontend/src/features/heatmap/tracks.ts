import { teamBucket, teamBuckets } from '@/features/report/teams'
import type { AvailableTrack } from '@/shared/api'

/**
 * `available_track_ids` as something to tick.
 *
 * The list is deliberately **not** narrowed by the track filter: the backend
 * applies `track_ids` to the points only, so the picker keeps offering every
 * track while the cloud shows one. Perspective and the time window do narrow
 * it — those describe which tracks were on the court at all.
 *
 * Selection is an inclusion list, matching the endpoint: an empty selection is
 * no filter server-side, so "none selected" means "every player" and there is no
 * way to ask for nothing.
 */

export interface TrackBucket {
  /** A bucket of the raw `team` column — `A`, `B`, `U`, or whatever else. */
  team: string
  tracks: AvailableTrack[]
  /** How many of this bucket's tracks the selection holds. */
  selected: number
}

export function trackBuckets(
  tracks: readonly AvailableTrack[],
  selected: readonly number[] = [],
): TrackBucket[] {
  const chosen = new Set(selected)

  return teamBuckets(tracks.map((track) => track.team)).map((team) => {
    const inTeam = tracks.filter((track) => teamBucket(track.team) === team)

    return {
      team,
      tracks: inTeam,
      selected: inTeam.filter((track) => chosen.has(track.track_id)).length,
    }
  })
}

/**
 * The selection with one track flipped, in ascending order.
 *
 * Sorted because the array is a query key and a URL: `[7,3]` and `[3,7]` are the
 * same filter, and an insertion-ordered list would cache and link as two.
 */
export function toggleTrack(
  selected: readonly number[] = [],
  trackId: number,
): number[] {
  const next = selected.includes(trackId)
    ? selected.filter((id) => id !== trackId)
    : [...selected, trackId]

  return [...next].sort((a, b) => a - b)
}

/** Adds or removes a whole bucket, whichever the bucket is not already. */
export function toggleBucket(
  selected: readonly number[] = [],
  bucket: TrackBucket,
): number[] {
  const ids = bucket.tracks.map((track) => track.track_id)
  const complete = bucket.selected === bucket.tracks.length

  const next = complete
    ? selected.filter((id) => !ids.includes(id))
    : [...new Set([...selected, ...ids])]

  return [...next].sort((a, b) => a - b)
}

/**
 * The selection as the search param carries it: `undefined` rather than `[]`,
 * because an empty array would sit in the URL claiming to be a filter while the
 * backend ignores it.
 */
export function asTrackParam(selected: readonly number[]): number[] | undefined {
  return selected.length === 0 ? undefined : [...selected]
}
