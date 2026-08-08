import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * One measured figure. `value: null` renders a dash rather than a zero —
 * every report field has to be able to say "not measured", which is what the
 * legacy app's mock fallbacks hid.
 */
export function StatTile({
  label,
  value,
  unit,
  hint,
  className,
}: {
  label: ReactNode
  value: ReactNode | null
  unit?: ReactNode
  hint?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const missing = value === null || value === undefined

  return (
    <Card className={cn('gap-1 px-4 py-4', className)}>
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className="flex items-baseline gap-1">
        {missing ? (
          <span className="text-2xl font-semibold text-muted-foreground">
            <span aria-hidden="true">—</span>
            <span className="sr-only">{t('states.empty')}</span>
          </span>
        ) : (
          <>
            <span className="text-2xl font-semibold tabular-nums tracking-tight">
              {value}
            </span>
            {unit ? (
              <span className="text-sm text-muted-foreground">{unit}</span>
            ) : null}
          </>
        )}
      </p>

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  )
}
