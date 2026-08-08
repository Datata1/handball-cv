import { LoadingState } from '@/shared/ui'

/**
 * Shown while a route loader runs. `defaultPendingMs` in `app/router.tsx`
 * decides whether it is shown at all.
 */
export function RoutePending() {
  return <LoadingState lines={4} />
}
