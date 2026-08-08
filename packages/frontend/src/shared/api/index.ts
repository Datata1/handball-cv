/**
 * The app's only door to the backend.
 *
 * Framework-free on purpose — plain async functions, no hooks, no caching, no
 * retry. `shared/query` wraps these in TanStack Query; everything below stays
 * testable without a renderer.
 */

export { API_PREFIX, apiUrl, formatTrackIds } from './client'
export * from './endpoints/formations'
export * from './endpoints/matches'
export * from './endpoints/plays'
export * from './endpoints/teamPhases'
export * from './endpoints/upload'
export {
  type AnyApiError,
  ApiError,
  ApiTransportError,
  ApiValidationError,
  apiErrorKey,
  isApiError,
} from './errors'
export * from './schemas/common'
export * from './schemas/formations'
export * from './schemas/matches'
export * from './schemas/plays'
export * from './schemas/teamPhases'
export * from './schemas/upload'
