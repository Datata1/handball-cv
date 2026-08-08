import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { StreamState } from '../sse'

/**
 * Tells the user the push channel is down.
 *
 * Renders nothing while the stream is healthy — this is a fault indicator, not
 * a status light, and a permanent green dot teaches people to ignore it. The
 * legacy dashboard swallowed `EventSource` errors entirely, so a dropped stream
 * looked exactly like a match that had stopped progressing.
 *
 * Presentational: it takes the state as a prop so the story can render both
 * halves of it. `LiveConnectionIndicator` is the wired version.
 */
export function ConnectionIndicator({
  state,
  className,
}: {
  state: StreamState
  className?: string
}) {
  const { t } = useTranslation()

  // `connecting` is deliberately silent: the first connection resolves in
  // milliseconds, and flashing a warning during it would cry wolf on every load.
  if (state !== 'interrupted') return null

  return (
    <p role="status" className={cn('flex items-center gap-2 text-sm', className)}>
      <span
        className="size-2 shrink-0 rounded-full bg-destructive"
        aria-hidden="true"
      />
      {t('connection.interrupted')}
      <span className="sr-only">{t('connection.reconnecting')}</span>
    </p>
  )
}
