import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { toPercent } from './percent'

const TONES = {
  primary: 'bg-chart-1',
  accent: 'bg-chart-2',
  neutral: 'bg-muted-foreground',
} as const

/**
 * One proportion, as a labelled track: possession share, formation frequency,
 * play-type distribution.
 *
 * The label row carries the numbers, so the track itself is decorative and
 * hidden from assistive tech rather than pretending to be a meter.
 */
export function Bar({
  label,
  value,
  max = 1,
  valueLabel,
  tone = 'primary',
  className,
}: {
  label: ReactNode
  value: number
  max?: number
  /** Defaults to the share as a percentage. */
  valueLabel?: ReactNode
  tone?: keyof typeof TONES
  className?: string
}) {
  const { t } = useTranslation()
  const percent = toPercent(value, max)

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">
          {valueLabel ?? t('units.percent', { value: Math.round(percent) })}
        </span>
      </div>

      <div
        aria-hidden="true"
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        {/* Inline width, not a class: a `w-[${percent}%]` template is exactly
            the dead dynamic class the legacy app shipped. */}
        <div
          className={cn('h-full rounded-full', TONES[tone])}
          style={{ inlineSize: `${percent}%` }}
        />
      </div>
    </div>
  )
}
