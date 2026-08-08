import { QueryClient } from '@tanstack/react-query'

import type { qk } from './keys'
import { retryDelay, shouldRetryMutation, shouldRetryQuery } from './retry'

const SHORT = 30_000
const MEDIUM = 5 * 60_000
const LONG = 30 * 60_000

/** The queries in `qk` — `all` and `match` are invalidation prefixes, not queries. */
type QueryName = Exclude<keyof typeof qk, 'all' | 'match'>

/**
 * How long each endpoint's data stays fresh.
 *
 * One global value would be wrong by orders of magnitude in both directions:
 * these endpoints range from a status list the SSE stream keeps current to a
 * ten-query aggregate that scans four tables. The annotation is per endpoint so
 * a feature PR picks a number rather than inventing one.
 *
 * Typed against `qk`, so a new query key without a staleTime is a compile error.
 *
 * The legacy app cached `/stats` in a module-level `Map` that never expired
 * except on `patchMatch`. A long staleTime buys the same avoided refetches, and
 * unlike that `Map` it is still invalidated when the match actually changes.
 */
export const staleTime: Record<QueryName, number> = {
  /** SSE pushes freshness; this only bounds the gap after a missed event. */
  matches: SHORT,
  /** Ten DuckDB queries, four full table scans, up to 12 000 points. */
  stats: LONG,
  /** Pays the full unbounded `/formations` cost server-side. */
  formationSummary: LONG,
  /** Immutable once ingested — the OCR is not re-run. */
  scoreboard: LONG,
  scoreboardSummary: LONG,
  goals: LONG,
  /** Small and cheap; one row per scene, phase or play. */
  formationScenes: MEDIUM,
  plays: MEDIUM,
  playSummary: MEDIUM,
  attacks: MEDIUM,
  teamPhases: MEDIUM,
  /** Up to 12 000 points, but per filter combination. */
  heatmap: MEDIUM,
  /** Flips from absent to present while the match is still processing. */
  outputVideo: SHORT,
}

/**
 * The app's `QueryClient`.
 *
 * Built by a factory rather than exported as a module singleton so tests and
 * stories get a clean cache per mount; the app calls it exactly once, in
 * `AppProviders`.
 */
export function createQueryClient(): QueryClient {
  // Annotated because `retry` closes over the client being constructed — the
  // callback only runs after the constructor has returned.
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: MEDIUM,
        retry: (failureCount, error) =>
          shouldRetryQuery(failureCount, error, queryClient),
        retryDelay,
        // The SSE stream is the push channel. Refetching on every tab focus on
        // top of that is duplicated work, and `/matches` is side-effecting —
        // each call can emit status events of its own.
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: shouldRetryMutation,
        retryDelay,
      },
    },
  })

  return queryClient
}
