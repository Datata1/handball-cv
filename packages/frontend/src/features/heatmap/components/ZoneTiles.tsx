import { Grid2x2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { TeamName } from '@/features/report/teams'
import type { BackendLabel } from '@/i18n/backend-label'
import type { MatchStats } from '@/shared/api'
import type { CourtHalf } from '@/shared/court'
import { EmptyState, ErrorState, LoadingState, Section } from '@/shared/ui'

import { hasZoneActivity, zoneTiles } from '../tiles'
import { ZoneTile } from './ZoneTile'

const HALVES: CourtHalf[] = ['left', 'right']

/**
 * Both halves of the court as six zones each.
 *
 * These come from `/stats`, which summarises the whole match and takes no
 * parameters — so nothing the density view is filtered by applies here, and the
 * hint says so rather than leaving a trainer to wonder why a tile did not move.
 */
export function ZoneTiles({
  stats,
  error,
  frozen = false,
  onRetry,
  label,
  teamName,
}: {
  stats: MatchStats | undefined
  error?: unknown
  frozen?: boolean
  onRetry?: () => void
  label: BackendLabel
  teamName: TeamName
}) {
  const { t } = useTranslation('heatmap')

  const halves = useMemo(
    () =>
      stats === undefined
        ? []
        : HALVES.map((half) => ({ half, tiles: zoneTiles(stats, half) })),
    [stats],
  )

  if (error !== undefined && error !== null) {
    return <ErrorState error={error} processing={frozen} onRetry={onRetry} />
  }

  if (stats === undefined) return <LoadingState lines={6} label={t('tiles.loading')} />

  if (!halves.some(({ tiles }) => hasZoneActivity(tiles))) {
    return (
      <EmptyState
        icon={<Grid2x2 />}
        title={t('tiles.empty.title')}
        description={t('tiles.empty.description')}
      />
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">{t('tiles.hint')}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {halves.map(({ half, tiles }) => (
          <Section key={half} headingLevel={3} title={t(`tiles.${half}`)}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {tiles.map((tile) => (
                <ZoneTile
                  key={tile.zone}
                  tile={tile}
                  label={label('zone', tile.zone)}
                  teamName={teamName}
                />
              ))}
            </ul>
          </Section>
        ))}
      </div>
    </div>
  )
}
