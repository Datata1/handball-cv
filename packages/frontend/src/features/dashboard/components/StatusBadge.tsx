import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type { MatchStatus } from '@/shared/api'

const dot: Record<MatchStatus, string> = {
  done: 'bg-status-done',
  processing: 'bg-status-processing animate-pulse',
  failed: 'bg-status-failed',
  unknown: 'bg-status-unknown',
}

/** Where a match is in the pipeline. The dot tints the label, never replaces it. */
export function StatusBadge({
  status,
  className,
}: {
  status: MatchStatus
  className?: string
}) {
  const { t } = useTranslation('dashboard')

  // A record rather than t(`status.${status}`): building a key from a runtime
  // value defeats the typed catalogue, and useBackendLabel is the one place
  // allowed to do it.
  const label: Record<MatchStatus, string> = {
    done: t('status.done'),
    processing: t('status.processing'),
    failed: t('status.failed'),
    unknown: t('status.unknown'),
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-card-foreground',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', dot[status])} />
      {label[status]}
    </span>
  )
}
