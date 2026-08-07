import { z } from 'zod'

/**
 * One possession phase. `phase_type` is documented as
 * `'attack' | 'transition' | 'unclear'` but is an open string on the wire, and
 * the detector is being reworked — so `z.string()`, not `z.enum()`.
 */
export const teamPhaseSchema = z.object({
  phase_id: z.int(),
  offense_team: z.string(),
  defense_team: z.string(),
  phase_type: z.string(),
  start_frame: z.int(),
  end_frame: z.int(),
  start_time_s: z.number(),
  end_time_s: z.number(),
})
export type TeamPhase = z.infer<typeof teamPhaseSchema>

export const teamPhasesSchema = z.array(teamPhaseSchema)
