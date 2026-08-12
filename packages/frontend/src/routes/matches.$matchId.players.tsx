import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PlayerTracks } from '@/features/players/components/PlayerTracks'
import {
  DEFAULT_TRACK_SORT,
  nextSort,
  type TrackSortKey,
} from '@/features/players/tracks'
import { useMatchMeta } from '@/features/report/queries'
import { playersSearch } from '@/features/report/search'
import { teamNamer } from '@/features/report/teams'
import { useBackendLabel } from '@/i18n/backend-label'
import { matchStatsOptions } from '@/shared/matches'
import { mayBeFrozen } from '@/shared/query'
import { Section } from '@/shared/ui'

export const Route = createFileRoute('/matches/$matchId/players')({
  validateSearch: playersSearch,
  component: PlayersSection,
})

/**
 * What the tracker saw, per track. The overview has usually already fetched
 * `/stats`, so arriving here from it costs no request.
 */
function PlayersSection() {
  const { matchId } = Route.useParams()
  const { team, sort, dir } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { t } = useTranslation('players')
  const queryClient = useQueryClient()
  const label = useBackendLabel()

  const meta = useMatchMeta(matchId)
  const stats = useQuery(matchStatsOptions(matchId))

  const match = meta.data ?? null
  const teamName = useMemo(
    () =>
      teamNamer(match ?? { team_a_name: null, team_b_name: null }, (value) =>
        label('team', value),
      ),
    [match, label],
  )

  // The URL carries only what a trainer chose; the default order is the one the
  // backend already sent the rows in.
  const current = {
    key: sort ?? DEFAULT_TRACK_SORT.key,
    direction: dir ?? DEFAULT_TRACK_SORT.direction,
  }

  // Replaced rather than pushed: ordering a table is a way of reading it, and
  // four clicks through the columns would otherwise be four steps back out.
  function setTeam(value: string | undefined) {
    void navigate({
      search: (previous) => ({ ...previous, team: value }),
      replace: true,
    })
  }

  function setSort(key: TrackSortKey) {
    const order = nextSort(current, key)

    void navigate({
      search: (previous) => ({ ...previous, sort: order.key, dir: order.direction }),
      replace: true,
    })
  }

  return (
    <Section title={t('title')} description={t('tagline')}>
      <PlayerTracks
        stats={stats.data}
        error={stats.error}
        frozen={mayBeFrozen(queryClient)}
        onRetry={() => void stats.refetch()}
        teamName={teamName}
        sort={current}
        team={team}
        onSortChange={setSort}
        onTeamChange={setTeam}
      />
    </Section>
  )
}
