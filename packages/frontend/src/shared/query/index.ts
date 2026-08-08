/**
 * Everything server-state.
 *
 * `shared/api` is the door to the backend; this is the cache in front of it.
 * Features import `qk` and the staleTime table from here and never construct a
 * `QueryClient` of their own.
 */

export { createQueryClient, staleTime } from './client'
export { ConnectionIndicator } from './components/ConnectionIndicator'
export { LiveConnectionIndicator } from './components/LiveConnectionIndicator'
export { qk } from './keys'
export {
  hasProcessingMatch,
  MAX_RETRIES,
  mayBeFrozen,
  retryDelay,
  shouldRetryMutation,
  shouldRetryQuery,
} from './retry'
export {
  createStatusBridge,
  INVALIDATION_DEBOUNCE_MS,
  type StatusBridge,
  StatusStreamContext,
  type StreamState,
  useStatusStream,
  useStatusStreamState,
} from './sse'
