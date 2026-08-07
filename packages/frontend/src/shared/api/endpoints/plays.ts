import { jsonBody, request } from '../client'
import {
  attacksSchema,
  type PlayLabel,
  playLabelResultSchema,
  playSummaryListSchema,
  playsSchema,
} from '../schemas/plays'

export interface PlayFilters {
  /** Exact match against the detector's label. Not a closed set. */
  playType?: string
  /** The attacking team. */
  team?: string
}

/** Detected plays, ordered by start time. `[]` rather than 404 when there are none. */
export function getPlays(
  matchId: string,
  filters: PlayFilters = {},
  signal?: AbortSignal,
) {
  return request(`/matches/${encodeURIComponent(matchId)}/plays`, playsSchema, {
    signal,
    query: { play_type: filters.playType, team: filters.team },
  })
}

/** Counts per play type and team, plus the share of those attacks that scored. */
export function getPlaySummary(matchId: string, signal?: AbortSignal) {
  return request(
    `/matches/${encodeURIComponent(matchId)}/play-summary`,
    playSummaryListSchema,
    { signal },
  )
}

/** The attack sequences plays belong to. Unused by the legacy app; PR 17 needs it. */
export function getAttacks(matchId: string, signal?: AbortSignal) {
  return request(`/matches/${encodeURIComponent(matchId)}/attacks`, attacksSchema, {
    signal,
  })
}

/**
 * Stores or clears a coach verdict.
 *
 * **Nothing calls this yet, and nothing should.** The label loop is deferred
 * until the GCN + LSTM work lands; it is implemented here so the API layer is
 * complete and so the deferral stays a decision rather than an oversight.
 *
 * `verdict` must be present — `{}` is a 422. Pass `null` to clear.
 */
export function setPlayLabel(
  matchId: string,
  eventId: number,
  body: PlayLabel,
  signal?: AbortSignal,
) {
  return request(
    `/matches/${encodeURIComponent(matchId)}/plays/${eventId}/label`,
    playLabelResultSchema,
    { method: 'POST', signal, ...jsonBody(body) },
  )
}
