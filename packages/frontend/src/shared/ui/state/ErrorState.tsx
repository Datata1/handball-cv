import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ApiError, apiErrorKey } from '@/shared/api'

/**
 * The one place a thrown `ApiError` becomes German copy.
 *
 * `processing` is not cosmetic: while any match is being ingested the backend
 * returns 404 for matches that exist (see `db.py:28`), so a caller that has
 * checked `mayBeFrozen()` passes it here and the user reads "noch nicht
 * verfügbar" instead of "nicht gefunden".
 */
export function ErrorState({
  error,
  processing = false,
  onRetry,
  className,
}: {
  error: unknown
  processing?: boolean
  onRetry?: () => void
  className?: string
}) {
  const { t } = useTranslation()

  const frozen = processing && error instanceof ApiError && error.status === 404

  return (
    <Card
      role="alert"
      className={cn(
        'items-center gap-3 border-dashed px-6 py-10 text-center shadow-none',
        className,
      )}
    >
      <TriangleAlert
        aria-hidden="true"
        className={cn('size-8', frozen ? 'text-muted-foreground' : 'text-destructive')}
      />

      <p className="mx-auto max-w-prose text-sm text-muted-foreground text-pretty">
        {t(frozen ? 'errors.processing' : apiErrorKey(error))}
      </p>

      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('actions.retry')}
        </Button>
      ) : null}
    </Card>
  )
}
