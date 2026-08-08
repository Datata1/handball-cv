import type { QueryClient } from '@tanstack/react-query'

import {
  ApiError,
  ApiTransportError,
  ApiValidationError,
  type MatchMeta,
} from '@/shared/api'

import { qk } from './keys'

/** Four attempts total: the initial one plus three retries. */
export const MAX_RETRIES = 3

/** 1s, 2s, 4s, … capped. Long enough for an ingest step to finish a write. */
export function retryDelay(failureCount: number): number {
  return Math.min(1000 * 2 ** failureCount, 30_000)
}

/**
 * Is any match anywhere being ingested right now?
 *
 * `packages/backend/src/backend/db.py:28` — `query_duckdb` returns `[]` while a
 * *global* `processing` status exists, not just for the match being ingested.
 * Every read endpoint therefore degrades to empty results or a **404** for the
 * duration, for every match. This predicate is how the rest of the app tells
 * "the data is not there" apart from "the database is closed for a minute".
 *
 * Read from the cache rather than passed in, so `retry` can consult it without
 * every feature having to thread it through.
 */
export function hasProcessingMatch(queryClient: QueryClient): boolean {
  const matches = queryClient.getQueryData<MatchMeta[]>(qk.matches())

  return matches?.some((match) => match.status === 'processing') ?? false
}

/**
 * True when a 404 might still be the freeze rather than a real absence — either
 * something is processing, or we have not loaded the list yet and cannot tell.
 *
 * The second case is a deep link: opening `/matches/x/heatmap` in a fresh tab
 * fires the section's query alongside the list, not after it. Treating that as
 * terminal would render "not found" for a match that exists.
 */
export function mayBeFrozen(queryClient: QueryClient): boolean {
  return (
    queryClient.getQueryData<MatchMeta[]>(qk.matches()) === undefined ||
    hasProcessingMatch(queryClient)
  )
}

/**
 * The query retry policy.
 *
 *  - **Transport failures** retry: offline, a dropped connection, a backend
 *    restarting mid-ingest.
 *  - **404** retries only while the read freeze could be the cause — see
 *    `mayBeFrozen`. Outside that window it is terminal, because the match
 *    really is gone.
 *  - **503** retries: the label endpoint returns it for `Database busy`, which
 *    is by definition transient.
 *  - **Other 4xx** are terminal. A 422 will fail identically forever.
 *  - **5xx** retry.
 *  - **Schema drift** (`ApiValidationError`) is terminal. The backend changed
 *    its contract; three more identical requests will not change it back, and
 *    retrying only delays the error the developer needs to see.
 */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
  queryClient: QueryClient,
): boolean {
  if (failureCount >= MAX_RETRIES) return false
  if (error instanceof ApiValidationError) return false
  if (error instanceof ApiTransportError) return true

  if (error instanceof ApiError) {
    if (error.status === 404) return mayBeFrozen(queryClient)
    if (error.status === 503) return true

    return error.status >= 500
  }

  return false
}

/**
 * The mutation retry policy — deliberately narrower.
 *
 * Every mutation in this API is idempotent (`PATCH` sets fields, `DELETE`
 * removes a match, `POST .../label` overwrites a verdict), so a retry cannot
 * double-apply. But a mutation that reached the server and failed there is a
 * user-visible action: retrying a 500 four times means the user stares at a
 * spinner before seeing the error. Only the two cases that are known-transient
 * get another attempt.
 */
export function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false
  if (error instanceof ApiTransportError) return true

  return error instanceof ApiError && error.status === 503
}
