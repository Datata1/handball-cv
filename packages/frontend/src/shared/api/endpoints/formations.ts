import { request } from '../client'
import {
  formationScenesSchema,
  formationSummaryListSchema,
} from '../schemas/formations'

/**
 * `GET /matches/{id}/formations` is deliberately **not** wrapped here.
 *
 * It returns one object per frame per team — around 180 000 of them for a
 * 60-minute match, with no limit and no pagination. The two endpoints below
 * cover every view we build: the summary for distributions, the scenes for
 * anything seekable.
 */

/**
 * Formation distribution per team.
 *
 * Slow: the route materialises the full per-frame list server-side and counts
 * it in Python, so it pays the cost `/formations` would have. Cache it hard.
 * 404s when scoring has not run for the match.
 */
export function getFormationSummary(matchId: string, signal?: AbortSignal) {
  return request(
    `/matches/${encodeURIComponent(matchId)}/formation-summary`,
    formationSummaryListSchema,
    { signal },
  )
}

export interface FormationSceneFilters {
  team?: string
  /** An exact label match against whatever the classifier wrote. */
  formation?: string
}

/**
 * Uninterrupted runs of one formation, with timestamps for seeking.
 *
 * Returns `[]` rather than 404 when there is nothing to show, so an empty
 * result is a real empty state and not an error path.
 */
export function getFormationScenes(
  matchId: string,
  filters: FormationSceneFilters = {},
  signal?: AbortSignal,
) {
  return request(
    `/matches/${encodeURIComponent(matchId)}/formation-scenes`,
    formationScenesSchema,
    { signal, query: { team: filters.team, formation: filters.formation } },
  )
}
