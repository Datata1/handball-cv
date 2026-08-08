import { apiUrl, formatTrackIds, jsonBody, request } from '../client'
import {
  goalsSchema,
  heatmapPointsSchema,
  type MatchPatch,
  matchDeleteResultSchema,
  matchListSchema,
  matchPatchResultSchema,
  matchStatsSchema,
  scoreboardSchema,
  scoreboardSummarySchema,
} from '../schemas/matches'

/**
 * The Server-Sent Events stream — the only push channel in the system.
 *
 * A URL rather than a function because it is consumed by `EventSource`, not by
 * `fetch`. The wire protocol: `event: connected` on open, `event: status` with
 * a `StatusEvent` payload on every transition, and a bare `: heartbeat` comment
 * every 25 idle seconds. There is no `id:` field, so a reconnect cannot resume
 * — whatever happened during the gap is simply missed.
 */
export function statusStreamUrl(): string {
  return apiUrl('/status/stream')
}

/**
 * The match list.
 *
 * Side-effecting despite being a GET: it rewrites `unknown`/`processing` status
 * files to `done`, and each rewrite emits an SSE `status` event. A handler that
 * refetches this on every event therefore feeds itself — `shared/query/sse.ts`
 * debounces the bridge for exactly this reason.
 */
export function listMatches(signal?: AbortSignal) {
  return request('/matches', matchListSchema, { signal })
}

/**
 * Updates the editable metadata. Only the fields you pass change; there is no
 * way to clear one back to null, and a body with no fields at all is a 400.
 */
export function patchMatch(matchId: string, patch: MatchPatch, signal?: AbortSignal) {
  return request(`/matches/${encodeURIComponent(matchId)}`, matchPatchResultSchema, {
    method: 'PATCH',
    signal,
    ...jsonBody(patch),
  })
}

/**
 * Removes the match from the list and deletes its video files. The tracking
 * data stays in DuckDB.
 *
 * A 404 here does not prove the match is gone: the same status comes back when
 * the database is locked.
 */
export function deleteMatch(matchId: string, signal?: AbortSignal) {
  return request(`/matches/${encodeURIComponent(matchId)}`, matchDeleteResultSchema, {
    method: 'DELETE',
    signal,
  })
}

/**
 * The heaviest endpoint in the API — ten queries, up to 12 000 points. Cache it
 * accordingly.
 *
 * 404s while *any* match anywhere is being ingested, because the reads are
 * frozen and the route reads absence as "no such match". Do not render a
 * not-found state on a 404 here without checking whether something is
 * processing.
 */
export function getMatchStats(matchId: string, signal?: AbortSignal) {
  return request(`/matches/${encodeURIComponent(matchId)}/stats`, matchStatsSchema, {
    signal,
  })
}

export interface HeatmapPointsFilters {
  /** Scopes the query to one possession phase. Required for `perspective`. */
  phaseId?: number
  trackIds?: readonly number[]
  perspective?: 'offense' | 'defense' | 'both'
  /** Both bounds or neither — the backend ignores a lone one. */
  windowStartS?: number
  windowEndS?: number
}

export function getHeatmapPoints(
  matchId: string,
  filters: HeatmapPointsFilters = {},
  signal?: AbortSignal,
) {
  return request(
    `/matches/${encodeURIComponent(matchId)}/heatmap-points`,
    heatmapPointsSchema,
    {
      signal,
      query: {
        phase_id: filters.phaseId,
        track_ids: formatTrackIds(filters.trackIds),
        perspective: filters.perspective,
        window_start_s: filters.windowStartS,
        window_end_s: filters.windowEndS,
      },
    },
  )
}

/** Every scoreboard reading that had a legible clock. Unbounded — one row per OCR hit. */
export function getScoreboard(matchId: string, signal?: AbortSignal) {
  return request(
    `/matches/${encodeURIComponent(matchId)}/scoreboard`,
    scoreboardSchema,
    {
      signal,
    },
  )
}

/** Final score plus the goal timeline. 404s when the match has no scoreboard readings. */
export function getScoreboardSummary(matchId: string, signal?: AbortSignal) {
  return request(
    `/matches/${encodeURIComponent(matchId)}/scoreboard/summary`,
    scoreboardSummarySchema,
    { signal },
  )
}

/**
 * The goal timeline on its own. `getScoreboardSummary` returns the same rows
 * with `team` validated server-side — prefer it, and reach for this only when
 * the final score is genuinely unwanted.
 */
export function getGoals(matchId: string, signal?: AbortSignal) {
  return request(`/matches/${encodeURIComponent(matchId)}/goals`, goalsSchema, {
    signal,
  })
}

/**
 * The match video, range-capable and inline — this is the `src` for the report
 * player. Serves the annotated file when one exists, the original otherwise.
 */
export function matchVideoUrl(matchId: string): string {
  return apiUrl(`/matches/${encodeURIComponent(matchId)}/video`)
}

/**
 * A JPEG of frame 42. Decoded with OpenCV on every request and sent without
 * cache headers, so a list of these is a list of video decodes.
 */
export function matchThumbnailUrl(matchId: string): string {
  return apiUrl(`/matches/${encodeURIComponent(matchId)}/thumbnail`)
}
