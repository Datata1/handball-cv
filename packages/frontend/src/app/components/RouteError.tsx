import { useQueryClient } from '@tanstack/react-query'
import type { ErrorComponentProps } from '@tanstack/react-router'

import { mayBeFrozen } from '@/shared/query'
import { ErrorState } from '@/shared/ui'

/**
 * The router's `defaultErrorComponent`: anything a route throws — a loader
 * rejection, a `validateSearch` failure, a render crash — lands here.
 *
 * The `processing` flag is the reason this cannot just be `<ErrorState/>`: a
 * 404 raised while any match is being ingested means "not yet", not "gone"
 * (`db.py:28`), and only the query cache knows which of the two it is.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const queryClient = useQueryClient()

  return (
    <ErrorState error={error} processing={mayBeFrozen(queryClient)} onRetry={reset} />
  )
}
