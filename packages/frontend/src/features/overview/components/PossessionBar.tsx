import { useTranslation } from 'react-i18next'

import type { TeamName } from '@/features/report/teams'
import { EmptyState, SplitBar } from '@/shared/ui'

import { formatRate, type PossessionSplit } from '../figures'

/**
 * Who had the ball, as measured.
 *
 * The two shares are labelled with what `/stats` reported rather than with
 * their share of the bar: they are counted over the frames that had a ball
 * holder at all, so they only add up to 100 when every holder was placed in a
 * team. What is missing is named below the bar instead of being rounded away.
 */
export function PossessionBar({
  possession,
  teamName,
}: {
  possession: PossessionSplit | null
  teamName: TeamName
}) {
  const { t, i18n } = useTranslation('overview')
  const { t: tCommon } = useTranslation()

  if (possession === null) {
    return (
      <EmptyState
        title={t('possession.empty.title')}
        description={t('possession.empty.description')}
      />
    )
  }

  const share = (value: number) =>
    tCommon('units.percent', { value: formatRate(value, i18n.language) })

  return (
    <div className="space-y-2">
      <SplitBar
        start={{
          label: teamName('A'),
          value: possession.a,
          valueLabel: share(possession.a),
        }}
        end={{
          label: teamName('B'),
          value: possession.b,
          valueLabel: share(possession.b),
        }}
      />

      {possession.unassigned > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('possession.unassigned', { value: share(possession.unassigned) })}
        </p>
      ) : null}
    </div>
  )
}
