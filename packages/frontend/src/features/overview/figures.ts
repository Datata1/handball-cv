import type { MatchStats } from '@/shared/api'

/**
 * What `/stats` actually measured, separated from what it merely returned.
 *
 * Every rate in that response is `round(x / total_frames * 100, 1) if
 * total_frames else 0.0`, so a match whose row the read freeze emptied answers
 * with a full set of zeros. A zero that means "no frame was read" must not
 * reach a tile as a figure: `null` is how the design kit says "not measured",
 * and telling the two apart is the whole point of this section.
 */

export interface KeyFigures {
  frames: number | null
  durationSeconds: number | null
  /** Tracks, not players — a substitution or an occlusion starts a new one. */
  tracks: number | null
}

export interface DetectionRates {
  ball: number | null
  player: number | null
  field: number | null
}

export interface PossessionSplit {
  a: number
  b: number
  /** Frames whose ball holder the classifier never placed. Often 0. */
  unassigned: number
}

export function keyFigures(stats: MatchStats): KeyFigures {
  const read = stats.total_frames > 0

  return {
    frames: read ? stats.total_frames : null,
    durationSeconds: stats.duration_seconds > 0 ? stats.duration_seconds : null,
    tracks: read ? stats.players_detected : null,
  }
}

export function detectionRates(stats: MatchStats): DetectionRates {
  if (stats.total_frames <= 0) return { ball: null, player: null, field: null }

  return {
    ball: stats.ball_detection_rate,
    player: stats.player_detection_rate,
    field: stats.field_detection_rate,
  }
}

/**
 * The possession shares, or `null` when no frame had a ball holder at all.
 *
 * The two do not have to add up to 100: they are counted per team over the
 * frames with `has_ball`, and a holder the team classifier could not place
 * counts towards neither.
 */
export function possessionSplit(stats: MatchStats): PossessionSplit | null {
  const a = Math.max(0, stats.possession_a)
  const b = Math.max(0, stats.possession_b)

  if (a + b <= 0) return null

  return { a, b, unassigned: Math.max(0, round1(100 - a - b)) }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

/** A rate as its number alone — the `%` sign comes from `units.percent`. */
export function formatRate(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
}
