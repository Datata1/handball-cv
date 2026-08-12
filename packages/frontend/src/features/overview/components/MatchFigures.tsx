import { useTranslation } from 'react-i18next'

import type { TeamName } from '@/features/report/teams'
import type { MatchStats } from '@/shared/api'
import { ErrorState, LoadingState, Section, StatTile } from '@/shared/ui'
import { formatClock } from '@/shared/video'

import {
  detectionRates,
  formatCount,
  formatRate,
  keyFigures,
  possessionSplit,
} from '../figures'
import { PossessionBar } from './PossessionBar'

/**
 * Everything `/stats` says about this match: possession, the size of what was
 * processed, and how well the detectors did on it.
 *
 * One request feeds all three, so they share one loading state and one error
 * state rather than each showing its own.
 */
export function MatchFigures({
  stats,
  error,
  frozen = false,
  onRetry,
  teamName,
}: {
  stats: MatchStats | undefined
  error?: unknown
  frozen?: boolean
  onRetry?: () => void
  teamName: TeamName
}) {
  const { t, i18n } = useTranslation('overview')
  const { t: tCommon } = useTranslation()

  if (error !== undefined && error !== null) {
    return <ErrorState error={error} processing={frozen} onRetry={onRetry} />
  }

  if (stats === undefined)
    return <LoadingState lines={4} label={t('figures.loading')} />

  const figures = keyFigures(stats)
  const rates = detectionRates(stats)

  // `null` all the way to the tile, which is where "not measured" is rendered.
  const count = (value: number | null) =>
    value === null ? null : formatCount(value, i18n.language)

  const rate = (value: number | null) =>
    value === null
      ? null
      : tCommon('units.percent', { value: formatRate(value, i18n.language) })

  return (
    <>
      <Section headingLevel={3} title={t('possession.title')}>
        <PossessionBar possession={possessionSplit(stats)} teamName={teamName} />
      </Section>

      <Section headingLevel={3} title={t('figures.title')}>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label={t('figures.frames')} value={count(figures.frames)} />

          <StatTile
            label={t('figures.duration')}
            value={
              figures.durationSeconds === null
                ? null
                : formatClock(figures.durationSeconds)
            }
          />

          <StatTile
            label={t('figures.tracks')}
            value={count(figures.tracks)}
            hint={t('figures.tracksHint')}
          />
        </div>
      </Section>

      <Section
        headingLevel={3}
        title={t('quality.title')}
        description={t('quality.description')}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label={t('quality.ball')} value={rate(rates.ball)} />
          <StatTile label={t('quality.player')} value={rate(rates.player)} />
          <StatTile label={t('quality.field')} value={rate(rates.field)} />
        </div>
      </Section>
    </>
  )
}
