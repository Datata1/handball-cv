import { Swords } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { TeamName } from '@/features/report/teams'
import type { BackendLabel } from '@/i18n/backend-label'
import { cn } from '@/lib/utils'
import type { PlaySummary } from '@/shared/api'
import { Bar, EmptyState, ErrorState, LoadingState } from '@/shared/ui'

import { playTypeTable } from '../plays'

/**
 * Every play type the detector reported, most-detected first, each a way into
 * its scenes.
 *
 * The rows come from the response and nothing else. `label('playType', …)`
 * translates the ones there is German copy for and hands back the rest
 * unchanged, so a move the detector learns next appears under its own name —
 * the legacy section iterated its own dictionary of four and rendered nothing
 * for anything else.
 */
export function PlayTypeList({
  summary,
  error,
  frozen = false,
  onRetry,
  teamName,
  label,
  selected,
  onSelect,
}: {
  summary: PlaySummary[] | undefined
  error?: unknown
  frozen?: boolean
  onRetry?: () => void
  teamName: TeamName
  label: BackendLabel
  /** The play type drilled into, straight off the URL. */
  selected: string | undefined
  onSelect: (playType: string) => void
}) {
  const { t } = useTranslation('offense')
  const { t: tCommon } = useTranslation()

  const rows = useMemo(() => playTypeTable(summary ?? []), [summary])

  if (error !== undefined && error !== null) {
    return <ErrorState error={error} processing={frozen} onRetry={onRetry} />
  }

  if (summary === undefined) return <LoadingState lines={4} label={t('loading')} />

  // `/play-summary` answers `[]` rather than 404 when nothing was detected —
  // and `db.py:28` answers `[]` for every read while any match is being
  // ingested, so an empty list only means "none detected" once nothing is
  // frozen.
  if (rows.length === 0) {
    return frozen ? (
      <EmptyState
        title={t('frozen.title')}
        description={tCommon('errors.processing')}
      />
    ) : (
      <EmptyState
        icon={<Swords />}
        title={t('empty.title')}
        description={t('empty.description')}
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('playType.hint')}</p>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.playType}>
            <button
              type="button"
              aria-pressed={row.playType === selected}
              onClick={() => onSelect(row.playType)}
              className={cn(
                'w-full rounded-lg border border-border px-3 py-2 text-left transition-colors',
                'hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                'aria-pressed:border-primary aria-pressed:bg-muted',
              )}
            >
              <Bar
                label={
                  <span className="truncate font-medium text-foreground">
                    {label('playType', row.playType)}
                  </span>
                }
                value={row.share}
                valueLabel={t('playType.count', { count: row.total })}
              />

              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {row.teams.map((entry) => (
                  <span key={entry.team}>
                    {t('playType.team', {
                      team: teamName(entry.team),
                      count: entry.count,
                    })}
                  </span>
                ))}

                <span>
                  {/* No attack outcome was settled, which is not the same as
                      none of them scoring — `0 %` would say the latter. */}
                  {row.successRate === null
                    ? t('playType.unrated')
                    : t('playType.success', {
                        percent: Math.round(row.successRate * 100),
                        goals: row.attacksGoal,
                        rated: row.attacksRated,
                      })}
                </span>

                <span>
                  {t('playType.confidence', {
                    percent: Math.round(row.avgConfidence * 100),
                  })}
                </span>
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
