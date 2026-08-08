import { QueryClient } from '@tanstack/react-query'

import type { qk } from './keys'
import { retryDelay, shouldRetryMutation, shouldRetryQuery } from './retry'

const SHORT = 30_000
const MEDIUM = 5 * 60_000
const LONG = 30 * 60_000

/** `all` and `match` are invalidation prefixes, not queries. */
type QueryName = Exclude<keyof typeof qk, 'all' | 'match'>

/**
 * How long each endpoint's data stays fresh. Typed against `qk`, so a new query
 * key without an entry here is a compile error.
 */
export const staleTime: Record<QueryName, number> = {
  /** The SSE stream pushes freshness; this only bounds a missed event. */
  matches: SHORT,
  /** Ten DuckDB queries, four full table scans, up to 12 000 points. */
  stats: LONG,
  /** Pays the full unbounded `/formations` cost server-side. */
  formationSummary: LONG,
  /** Immutable once ingested — the OCR is not re-run. */
  scoreboard: LONG,
  scoreboardSummary: LONG,
  goals: LONG,
  formationScenes: MEDIUM,
  plays: MEDIUM,
  playSummary: MEDIUM,
  attacks: MEDIUM,
  teamPhases: MEDIUM,
  heatmap: MEDIUM,
  /** Flips from absent to present while the match is still processing. */
  outputVideo: SHORT,
}

/** A factory, not a singleton, so tests and stories get a clean cache. */
export function createQueryClient(): QueryClient {
  // Annotated because `retry` closes over the client being constructed.
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: MEDIUM,
        retry: (failureCount, error) =>
          shouldRetryQuery(failureCount, error, queryClient),
        retryDelay,
        // `GET /matches` is side-effecting (see sse.ts), so a focus refetch is
        // not free.
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
