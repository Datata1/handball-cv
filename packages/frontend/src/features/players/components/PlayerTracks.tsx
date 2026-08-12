import { useTranslation } from 'react-i18next'

import { type TeamName, teamBuckets } from '@/features/report/teams'
import type { MatchStats } from '@/shared/api'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui'

import { filterTracks, sortTracks, type TrackSort, type TrackSortKey } from '../tracks'
import { TeamFilter } from './TeamFilter'
import { TrackTable } from './TrackTable'

/**
 * `player_stats` as a table a trainer can order and narrow.
 *
 * Both controls are applied here rather than by the server: the response holds
 * at most 25 rows, and re-requesting it would cost ten DuckDB queries to sort a
 * list that is already in the cache.
 */
export function PlayerTracks({
  stats,
  error,
  frozen = false,
  onRetry,
  teamName,
  sort,
  team,
  onSortChange,
  onTeamChange,
}: {
  stats: MatchStats | undefined
  error?: unknown
  frozen?: boolean
  onRetry?: () => void
  teamName: TeamName
  sort: TrackSort
  team: string | undefined
  onSortChange: (key: TrackSortKey) => void
  onTeamChange: (team: string | undefined) => void
}) {
  const { t } = useTranslation('players')

  if (error !== undefined && error !== null) {
    return <ErrorState error={error} processing={frozen} onRetry={onRetry} />
  }

  if (stats === undefined) return <LoadingState lines={6} label={t('table.loading')} />

  const all = stats.player_stats

  if (all.length === 0) {
    return <EmptyState title={t('empty.title')} description={t('empty.description')} />
  }

  const visible = sortTracks(filterTracks(all, team), sort)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TeamFilter
          teams={teamBuckets(all.map((track) => track.team))}
          selected={team}
          onSelect={onTeamChange}
          teamName={teamName}
        />

        <p className="text-sm text-muted-foreground">
          {visible.length === all.length
            ? t('table.count', { count: all.length })
            : t('table.countFiltered', { shown: visible.length, total: all.length })}
        </p>
      </div>

      <TrackTable
        tracks={visible}
        sort={sort}
        onSort={onSortChange}
        teamName={teamName}
        empty={t('noneInTeam')}
      />
    </div>
  )
}
