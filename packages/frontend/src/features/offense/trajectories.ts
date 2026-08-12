import { z } from 'zod'

import { COURT_LENGTH_M, type CourtEnd, type CourtPoint } from '@/shared/court'

/**
 * The part of a play event's `details` the court draws.
 *
 * `details` is `dict[str, Any]` server-side — the detector is free to change
 * what it writes, and each of the four current detectors writes a different set
 * of keys. The API layer therefore types it as an opaque record and the shape is
 * narrowed here, at the one place that reads it: an event whose details this
 * cannot make sense of loses its trajectories, not its row.
 */

/** `[t, x, y]` — seconds, then court metres. */
const pointSchema = z.tuple([z.number(), z.number(), z.number()])

const trackSchema = z.object({
  /** `-1` is the team centroid rather than a player. */
  track_id: z.number(),
  points: z.array(pointSchema),
})

const detailsSchema = z.object({
  // The attacked goal, in metres along the long axis. Caught rather than
  // required: a goal marker nobody can place is no reason to drop the runs.
  goal_x: z.number().nullish().catch(null),
  // A track that does not parse is dropped whole rather than repaired: a
  // polyline through the points that happened to survive is a path nobody ran.
  tracks: z.array(trackSchema.nullable().catch(null)).nullish(),
})

/** Two points is the least a polyline can be drawn from. */
const MIN_POINTS = 2

export interface PlayTrack {
  trackId: number
  /** The team centroid, which is a statistic and not a player. */
  centroid: boolean
  points: CourtPoint[]
  /** Seconds at the first and last point. */
  from: number
  to: number
}

export interface PlayTrajectories {
  /** The end being attacked, when the detector recorded one. */
  goal: CourtEnd | null
  tracks: PlayTrack[]
}

/**
 * The trajectories of one play, or `null` when there are none to draw.
 *
 * `null` covers every way this can come up empty — details absent, a detector
 * that stores no trajectories, a shape that does not parse — because they are
 * one thing to the reader: this scene has no run-up to show.
 */
export function playTrajectories(
  details: Record<string, unknown> | null,
): PlayTrajectories | null {
  if (details === null) return null

  const parsed = detailsSchema.safeParse(details)
  if (!parsed.success) return null

  const tracks = (parsed.data.tracks ?? [])
    .filter((track) => track !== null)
    .filter((track) => track.points.length >= MIN_POINTS)
    .map((track): PlayTrack => {
      const points = track.points.map(([, x, y]) => ({ x, y }))

      return {
        trackId: track.track_id,
        centroid: track.track_id === -1,
        points,
        from: track.points[0][0],
        to: track.points[track.points.length - 1][0],
      }
    })

  if (tracks.length === 0) return null

  return { goal: goalEnd(parsed.data.goal_x), tracks }
}

function goalEnd(goalX: number | null | undefined): CourtEnd | null {
  if (goalX === null || goalX === undefined || !Number.isFinite(goalX)) return null

  return goalX < COURT_LENGTH_M / 2 ? 'left' : 'right'
}
