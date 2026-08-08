import type { QueryClient } from '@tanstack/react-query'

import {
  ApiError,
  ApiTransportError,
  ApiValidationError,
  type MatchMeta,
} from '@/shared/api'

import { qk } from './keys'

export const MAX_RETRIES = 3

export function retryDelay(failureCount: number): number {
  return Math.min(1000 * 2 ** failureCount, 30_000)
}

/**
 * Whether any match anywhere is being ingested.
 *
 * `packages/backend/src/backend/db.py:28` — `query_duckdb` returns `[]` while a
 * *global* `processing` status exists, not just for the match being ingested.
 * Every read endpoint degrades to empty results or a 404 for the duration, for
 * every match.
 */
export function hasProcessingMatch(queryClient: QueryClient): boolean {
  const matches = queryClient.getQueryData<MatchMeta[]>(qk.matches())

  return matches?.some((match) => match.status === 'processing') ?? false
}

/**
 * Whether a 404 might be the freeze above rather than a real absence. **Check
 * this before rendering a not-found state.**
 *
 * An unloaded match list counts as ambiguous: a deep link fires the section's
 * query alongside the list, not after it.
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
 * `ApiValidationError` means the backend changed its contract, so retrying only
 * delays an error someone has to read. 503 is the label endpoint's
 * `Database busy`.
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
 * The mutation retry policy, narrower than the query one.
 *
 * Every mutation here is idempotent, so a retry cannot double-apply — but a
 * mutation is a user-visible action, and retrying a 500 means the user watches
 * a spinner before seeing an error they could have acted on. Only the two
 * known-transient failures get another attempt.
 */
export function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false
  if (error instanceof ApiTransportError) return true

  return error instanceof ApiError && error.status === 503
}
