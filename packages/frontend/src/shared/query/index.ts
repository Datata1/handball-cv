/** The cache in front of `shared/api`. Features never build a `QueryClient`. */

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
