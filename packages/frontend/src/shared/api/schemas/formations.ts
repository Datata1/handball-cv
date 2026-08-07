import { z } from 'zod'

/**
 * `formation` is `z.string()`, never `z.enum()`.
 *
 * The label set is moving from rule-based thresholds to a GCN + LSTM
 * classifier, and `formation-summary` returns an open `dict[str, int]` keyed by
 * whatever the model emitted. An enum here would hard-fail the entire response
 * the first time a new label appears. Render labels through `useBackendLabel`,
 * which falls back to the raw value.
 */
export const formationSummarySchema = z.object({
  team: z.string(),
  /** label → frame count. Open set. */
  formations: z.record(z.string(), z.int()),
  dominant: z.string(),
})
export type FormationSummary = z.infer<typeof formationSummarySchema>

export const formationSummaryListSchema = z.array(formationSummarySchema)

/** One uninterrupted run of a formation label, ready for video seeking. */
export const formationSceneSchema = z.object({
  scene_id: z.int(),
  team: z.string(),
  formation: z.string(),
  start_frame: z.int(),
  end_frame: z.int(),
  start_time_s: z.number(),
  end_time_s: z.number(),
})
export type FormationScene = z.infer<typeof formationSceneSchema>

export const formationScenesSchema = z.array(formationSceneSchema)
