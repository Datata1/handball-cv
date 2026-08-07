import { z } from 'zod'

/** `play_type`, like `formation`, is an open set — see `schemas/formations.ts`. */
export const playEventSchema = z.object({
  event_id: z.int(),
  play_type: z.string(),
  /** Attacking team, raw. */
  team: z.string(),
  start_frame: z.int(),
  end_frame: z.int(),
  start_time_s: z.number(),
  end_time_s: z.number(),
  /** Heuristic, 0–1. */
  confidence: z.number(),
  track_ids: z.array(z.int()),
  /**
   * Detector metadata and the downsampled trajectories the court view draws:
   * `{ goal_x, tracks: [{ track_id, points: [[t, x, y], …] }] }`. Free-form
   * `dict[str, Any]` server-side and the largest field per event — typing it
   * here would only pin down something the detector is free to change. PR 17
   * narrows the part it actually reads, at the point it reads it.
   */
  details: z.record(z.string(), z.unknown()).nullable(),
  /**
   * These three come from `LEFT JOIN`s that older databases lack. The route
   * falls back to a join-free query there, and `response_model` then fills the
   * gap with `null` — so `null` means "no attack sequence" and "this database
   * predates attack sequences" indistinguishably. `.default(null)` also covers
   * the missing-key case rather than failing the whole list.
   */
  sequence_id: z.int().nullable().default(null),
  /** `'goal' | 'no_goal' | 'unknown'` — open string, it comes from the scorer. */
  outcome: z.string().nullable().default(null),
  /** Coach verdict. The label loop is deferred; expect this to be `null`. */
  label: z.string().nullable().default(null),
})
export type PlayEvent = z.infer<typeof playEventSchema>

export const playsSchema = z.array(playEventSchema)

export const playSummarySchema = z.object({
  play_type: z.string(),
  team: z.string(),
  count: z.int(),
  avg_confidence: z.number(),
  /** Attacks containing this play whose outcome is known (needs scoreboard data). */
  attacks_rated: z.int().default(0),
  attacks_goal: z.int().default(0),
  /** `attacks_goal / attacks_rated`, or `null` when nothing was rated. */
  success_rate: z.number().nullable(),
})
export type PlaySummary = z.infer<typeof playSummarySchema>

export const playSummaryListSchema = z.array(playSummarySchema)

export const attackSequenceSchema = z.object({
  sequence_id: z.int(),
  team: z.string(),
  /** The attacked goal: 0 or 40 (metres along the long axis). */
  goal_x: z.number(),
  start_frame: z.int(),
  end_frame: z.int(),
  start_time_s: z.number(),
  end_time_s: z.number(),
  outcome: z.string(),
  event_count: z.int(),
})
export type AttackSequence = z.infer<typeof attackSequenceSchema>

export const attacksSchema = z.array(attackSequenceSchema)

/**
 * The coach label loop. Written for completeness only — no UI ships against it
 * until the GCN + LSTM work lands (see the roadmap's deferred list).
 *
 * `verdict` is required with no server-side default: `{}` is a 422, and
 * `{ verdict: null }` is how a label is cleared.
 */
export const playLabelSchema = z.object({
  verdict: z.enum(['correct', 'wrong']).nullable(),
})
export type PlayLabel = z.infer<typeof playLabelSchema>

export const playLabelResultSchema = z.object({
  ok: z.boolean(),
  event_id: z.int(),
  verdict: z.string().nullable(),
})
