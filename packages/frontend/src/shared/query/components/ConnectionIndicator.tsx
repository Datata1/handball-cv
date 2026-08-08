import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { StreamState } from '../sse'

/**
 * Warns that the push channel is down, so the view has stopped updating itself.
 *
 * Renders nothing otherwise — including while connecting, which resolves in
 * milliseconds and would flash a warning on every load.
 */
export function ConnectionIndicator({
  state,
  className,
}: {
  state: StreamState
  className?: string
}) {
  const { t } = useTranslation()

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
