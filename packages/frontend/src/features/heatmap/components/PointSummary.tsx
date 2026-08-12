import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { HeatmapPoint } from '@/shared/api'
import { EmptyState, LoadingState } from '@/shared/ui'

import { SPARSE_POINTS } from '../filters'

/**
 * What the filters actually selected, before anything is drawn from it.
 *
 * Positions are stored roughly four times a second and the query is capped, so
 * a narrow filter can leave a handful of points behind a heatmap that looks
 * empty rather than filtered. The legacy warning explained that with the SQL
 * that causes it; a trainer needs the consequence, not the sampling clause.
 */
export function PointSummary({
  points,
  filtered = false,
}: {
  /** `undefined` while the request is in flight; the section owns its error. */
  points: readonly HeatmapPoint[] | undefined
  /** Whether anything is narrowing the cloud — a thin sample is only then explainable. */
  filtered?: boolean
}) {
  const { t } = useTranslation('heatmap')

  if (points === undefined) {
    return <LoadingState lines={3} label={t('points.loading')} />
  }

  if (points.length === 0) {
    return (
      <EmptyState
        icon={<MapPin />}
        title={t('points.empty.title')}
        description={filtered ? t('points.empty.description') : undefined}
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="font-medium tabular-nums">
        {t('points.count', { count: points.length })}
      </p>

      {points.length < SPARSE_POINTS && filtered ? (
        <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          {t('points.sparse')}
        </p>
      ) : null}

      <EmptyState
        title={t('points.pending.title')}
        description={t('points.pending.description')}
      />
    </div>
  )
}
