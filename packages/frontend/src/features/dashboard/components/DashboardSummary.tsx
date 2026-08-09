import { useTranslation } from 'react-i18next'

import { formatMatchDate } from '@/shared/matches'
import { StatTile } from '@/shared/ui'

import type { MatchListSummary } from '../matches'

/**
 * The three figures above the list. Each one is either measured or a dash —
 * the legacy dashboard's fourth tile read "System-Status: Aktiv", which was a
 * green literal that reflected nothing.
 */
export function DashboardSummary({ summary }: { summary: MatchListSummary }) {
  const { t, i18n } = useTranslation('dashboard')

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatTile label={t('summary.total')} value={summary.total} />

      <StatTile
        label={t('summary.videoTime')}
        value={summary.videoMinutes}
        unit={summary.videoMinutes === null ? undefined : t('summary.minutesUnit')}
      />

      <StatTile
        label={t('summary.lastAnalysis')}
        value={formatMatchDate(summary.lastAnalysis, i18n.language)}
      />
    </div>
  )
}
