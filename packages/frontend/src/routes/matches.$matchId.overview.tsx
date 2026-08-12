import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { MatchFigures } from '@/features/overview/components/MatchFigures'
import { ScoreboardPanel } from '@/features/overview/components/ScoreboardPanel'
import { useMatchMeta, useScoreboardSummary } from '@/features/report/queries'
import { teamNamer } from '@/features/report/teams'
import { useBackendLabel } from '@/i18n/backend-label'
import { matchStatsOptions } from '@/shared/matches'
import { mayBeFrozen } from '@/shared/query'
import { Section } from '@/shared/ui'
import { usePlayer } from '@/stores'

export const Route = createFileRoute('/matches/$matchId/overview')({
  component: OverviewSection,
})

/**
 * The landing section of a report: what happened in this match, using only
 * numbers an endpoint actually reported.
 *
 * The match and the scoreboard are already in the cache — the shell loaded
 * both — so the only request this section adds is `/stats`, which the players
 * section then reads back out of the same entry.
 */
function OverviewSection() {
  const { matchId } = Route.useParams()
  const { t } = useTranslation('overview')
  const queryClient = useQueryClient()
  const player = usePlayer()
  const label = useBackendLabel()

  const meta = useMatchMeta(matchId)
  const scoreboard = useScoreboardSummary(matchId)
  const stats = useQuery(matchStatsOptions(matchId))

  const match = meta.data ?? null
  const teamName = useMemo(
    () =>
      teamNamer(match ?? { team_a_name: null, team_b_name: null }, (team) =>
        label('team', team),
      ),
    [match, label],
  )

  // Every read is 404 or empty while any match is being ingested, so the two
  // panels below have to be able to say "not yet" rather than "not there".
  const frozen = mayBeFrozen(queryClient)

  return (
    <Section title={t('title')} description={t('tagline')} className="space-y-8">
      <Section
        headingLevel={3}
        title={t('scoreboard.title')}
        description={t('scoreboard.hint')}
      >
        <ScoreboardPanel
          summary={scoreboard.data}
          error={scoreboard.error}
          frozen={frozen}
          onRetry={() => void scoreboard.refetch()}
          onSelectGoal={(goal) => player.seek(goal.timestamp_sec)}
        />
      </Section>

      <MatchFigures
        stats={stats.data}
        error={stats.error}
        frozen={frozen}
        onRetry={() => void stats.refetch()}
        teamName={teamName}
      />
    </Section>
  )
}
