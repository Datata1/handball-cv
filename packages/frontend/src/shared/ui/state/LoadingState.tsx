import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * A placeholder for content whose shape is known — skeleton rather than
 * spinner, so the layout does not jump when the data lands.
 *
 * Where the shape is more specific than "some lines of text", compose
 * `Skeleton` directly and wrap it in this component's live region.
 */
export function LoadingState({
  lines = 3,
  label,
  className,
}: {
  lines?: number
  /** Overrides the announcement, e.g. "Spiele werden geladen…". */
  label?: string
  className?: string
}) {
  const { t } = useTranslation()

  const rows = Array.from({ length: lines }, (_, index) => ({
    id: `line-${index}`,
    // The last line runs short, the way a paragraph does.
    width: index === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full',
  }))

  return (
    <div role="status" aria-busy="true" className={cn('space-y-2', className)}>
      <span className="sr-only">{label ?? t('states.loading')}</span>

      {rows.map((row) => (
        <Skeleton key={row.id} className={cn('h-4', row.width)} />
      ))}
    </div>
  )
}
