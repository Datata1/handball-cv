import { request } from '../client'
import { teamPhasesSchema } from '../schemas/teamPhases'

export interface TeamPhaseFilters {
  /**
   * Filters on **offense_team only** — passing `'A'` gives the phases where A
   * is attacking, not every phase A took part in.
   */
  team?: string
  phaseType?: string
}

/** Possession phases, ordered by start frame. The timeline's backbone in PR 12. */
export function getTeamPhases(
  matchId: string,
  filters: TeamPhaseFilters = {},
  signal?: AbortSignal,
) {
  return request(
    `/matches/${encodeURIComponent(matchId)}/team-phases`,
    teamPhasesSchema,
    {
      signal,
      query: { team: filters.team, phase_type: filters.phaseType },
    },
  )
}
