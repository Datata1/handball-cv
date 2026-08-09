import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Outlet, retainSearchParams } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { RouteNotFound } from '@/app/components/RouteNotFound'
import { ReportHeader } from '@/features/report/components/ReportHeader'
import { ReportPlayer } from '@/features/report/components/ReportPlayer'
import { ReportTimeline } from '@/features/report/components/ReportTimeline'
import { SectionNav } from '@/features/report/components/SectionNav'
import {
  useFormationScenes,
  useMatchMeta,
  useOutputVideo,
  usePlays,
  useScoreboardSummary,
  useTeamPhases,
} from '@/features/report/queries'
import { reportSearch } from '@/features/report/search'
import { teamNamer } from '@/features/report/teams'
import { buildTimelineTracks, type TimelineLabels } from '@/features/report/timeline'
import { annotatedState, matchDurationSeconds } from '@/features/report/video'
import { useBackendLabel } from '@/i18n/backend-label'
import { useRenameMatch } from '@/shared/matches'
import { mayBeFrozen } from '@/shared/query'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui'
import { usePlayer } from '@/stores'

export const Route = createFileRoute('/matches/$matchId')({
  validateSearch: reportSearch,
  // The playhead belongs to the match, not to a section, so it survives moving
  // between them. Section filters deliberately do not.
  search: { middlewares: [retainSearchParams(['at'])] },
  component: ReportLayout,
})

/**
 * The frame every section renders inside: the match named, one video, one
 * timeline, and the section links.
 *
 * It is a layout route, so switching section re-renders the `<Outlet/>` and
 * nothing else — the video element is never unmounted and playback carries on
 * across the navigation. Every query here is loaded once for the whole report;
 * sections read them back out of the cache.
 */
function ReportLayout() {
  const { matchId } = Route.useParams()
  const { at } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { t } = useTranslation('report')
  const label = useBackendLabel()
  const queryClient = useQueryClient()
  const player = usePlayer()

  const meta = useMatchMeta(matchId)
  const rename = useRenameMatch()
  const phases = useTeamPhases(matchId)
  const scoreboard = useScoreboardSummary(matchId)
  const plays = usePlays(matchId)
  const formations = useFormationScenes(matchId)
  const output = useOutputVideo(matchId)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const match = meta.data ?? null
  const teamName = useMemo(
    () =>
      teamNamer(match ?? { team_a_name: null, team_b_name: null }, (team) =>
        label('team', team),
      ),
    [match, label],
  )

  const labels = useMemo<TimelineLabels>(
    () => ({
      tracks: {
        goals: t('timeline.goals'),
        phases: t('timeline.phases'),
        plays: t('timeline.plays'),
        formations: t('timeline.formations'),
      },
      goal: (goal) =>
        t('timeline.goalItem', {
          team: t(goal.team === 'home' ? 'teams.home' : 'teams.away'),
          home: goal.score_home,
          away: goal.score_away,
        }),
      phase: (phase) =>
        t('timeline.phaseItem', {
          type: label('phase', phase.phase_type),
          team: teamName(phase.offense_team),
        }),
      play: (play) =>
        t('timeline.playItem', {
          play: label('playType', play.play_type),
          team: teamName(play.team),
        }),
      formation: (scene) =>
        t('timeline.formationItem', {
          formation: label('formation', scene.formation),
          team: teamName(scene.team),
        }),
    }),
    [t, label, teamName],
  )

  const tracks = useMemo(
    () =>
      buildTimelineTracks(
        {
          goals: scoreboard.data?.goals,
          phases: phases.data,
          plays: plays.data,
          formations: formations.data,
        },
        labels,
      ),
    [scoreboard.data, phases.data, plays.data, formations.data, labels],
  )

  // A deep link into the match. It is applied when it changes and never written
  // back on a tick — only `ShareMomentButton` writes it, so the history stack
  // holds moments a trainer chose.
  useEffect(() => {
    if (at !== undefined) player.seek(at)
  }, [at, player])

  // The list answers with status-file stubs while a match is being ingested, so
  // a match missing from it is only genuinely missing once nothing is frozen.
  if (match === null && !meta.isPending && !meta.error && !mayBeFrozen(queryClient)) {
    return <RouteNotFound />
  }

  return (
    <>
      {match === null ? (
        <UnavailableMatch
          error={meta.error}
          pending={meta.isPending}
          onRetry={() => void meta.refetch()}
          frozen={mayBeFrozen(queryClient)}
        />
      ) : (
        <>
          <ReportHeader match={match} rename={rename} />

          <ReportPlayer
            matchId={matchId}
            status={match.status}
            annotated={annotatedState(output.data)}
            phases={phases.data ?? []}
            teamName={teamName}
            onShareMoment={(seconds) =>
              void navigate({ search: (current) => ({ ...current, at: seconds }) })
            }
          />

          <ReportTimeline
            duration={matchDurationSeconds(match)}
            tracks={tracks}
            selectedId={selectedId}
            onSelect={(selection) => setSelectedId(selection?.item.id ?? null)}
          />
        </>
      )}

      {/* Below the chrome either way: a section fetches its own data, and a
          match list that failed says nothing about whether it will answer. */}
      <SectionNav matchId={matchId} />

      <Outlet />
    </>
  )
}

/** The three ways the shell can have no match to put at the top of itself. */
function UnavailableMatch({
  error,
  pending,
  frozen,
  onRetry,
}: {
  error: unknown
  pending: boolean
  frozen: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation('report')
  const { t: tCommon } = useTranslation()

  if (pending) return <LoadingState lines={3} />

  if (error) return <ErrorState error={error} processing={frozen} onRetry={onRetry} />

  return (
    <EmptyState title={t('frozen.title')} description={tCommon('errors.processing')} />
  )
}
