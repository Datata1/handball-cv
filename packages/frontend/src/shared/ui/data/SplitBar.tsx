import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { toPercent } from './percent'

export type SplitSide = {
  label: ReactNode
  value: number
  /** Defaults to this side's share as a percentage. */
  valueLabel?: ReactNode
}

/**
 * Two shares of one whole, facing each other — possession, shots, phases.
 * Sides are normalised against their sum, so callers pass raw counts.
 */
export function SplitBar({
  start,
  end,
  className,
}: {
  start: SplitSide
  end: SplitSide
  className?: string
}) {
  const { t } = useTranslation()

  const total = Math.max(0, start.value) + Math.max(0, end.value)
  const startPercent = toPercent(start.value, total)
  const endPercent = total > 0 ? 100 - startPercent : 0

  const share = (percent: number) => t('units.percent', { value: Math.round(percent) })

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-medium">{start.label}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {start.valueLabel ?? share(startPercent)}
          </span>
        </span>

        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {end.valueLabel ?? share(endPercent)}
          </span>
          <span className="truncate font-medium">{end.label}</span>
        </span>
      </div>

      <div
        aria-hidden="true"
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="bg-chart-1" style={{ inlineSize: `${startPercent}%` }} />
        <div className="bg-chart-2" style={{ inlineSize: `${endPercent}%` }} />
      </div>
    </div>
  )
}
