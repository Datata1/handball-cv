import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PlaySceneList } from '@/features/offense/components/PlaySceneList'
import { PlayTrajectory } from '@/features/offense/components/PlayTrajectory'
import { PlayTypeList } from '@/features/offense/components/PlayTypeList'
import { playsFor } from '@/features/offense/plays'
import { usePlaySummary } from '@/features/offense/queries'
import { useMatchMeta, usePlays } from '@/features/report/queries'
import { offenseSearch } from '@/features/report/search'
import { teamNamer } from '@/features/report/teams'
import { playItemId } from '@/features/report/timeline'
import { useBackendLabel } from '@/i18n/backend-label'
import { mayBeFrozen } from '@/shared/query'
import { Section } from '@/shared/ui'
import { usePlayer, useSelection } from '@/stores'

export const Route = createFileRoute('/matches/$matchId/offense')({
  validateSearch: offenseSearch,
  // An `observer` because the scene this section points at is held in the
  // selection store: the shell draws the timeline it highlights on, and the
  // store is what reaches across the `<Outlet/>`.
  component: observer(OffenseSection),
})

/** Which offensive plays the detector found, how they ended, and where they ran. */
function OffenseSection() {
  const { matchId } = Route.useParams()
  const { playType } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { t } = useTranslation('offense')
  const queryClient = useQueryClient()
  const player = usePlayer()
  const selection = useSelection()
  const label = useBackendLabel()

  const meta = useMatchMeta(matchId)
  const summary = usePlaySummary(matchId)
  // Every play of the match, loaded once by the shell for the timeline. The
  // endpoint's own `?play_type` would describe the same rows a second time.
  const allPlays = usePlays(matchId)

  const match = meta.data ?? null
  const teamName = useMemo(
    () =>
      teamNamer(match ?? { team_a_name: null, team_b_name: null }, (value) =>
        label('team', value),
      ),
    [match, label],
  )

  const plays = useMemo(
    () =>
      playType === undefined || allPlays.data === undefined
        ? undefined
        : playsFor(allPlays.data, { playType }),
    [allPlays.data, playType],
  )

  // What the report is pointing at, if it is one of the plays on screen. The
  // timeline highlights it too — the shell drew the item, this named it.
  const selectedPlay =
    plays?.find((play) => playItemId(play.event_id) === selection.timelineItemId) ??
    null

  const clipStart = selectedPlay?.start_time_s ?? null
  const clipEnd = selectedPlay?.end_time_s ?? null

  // The clip is a function of the selected play, so it is released the moment
  // there isn't one: the pick cleared, the drill-in changed, the section left.
  // A clip that outlived its scene would confine playback elsewhere in the
  // report with nothing on screen to say why.
  useEffect(() => {
    if (clipStart === null || clipEnd === null) {
      player.clearClip()
      return
    }

    player.setClip({ start: clipStart, end: clipEnd })
    player.seek(clipStart)

    return () => player.clearClip()
  }, [clipStart, clipEnd, player])

  // Pushed, not replaced: drilling into a play type is a step a trainer takes
  // and expects the back button to undo.
  function drillIn(next: string) {
    void navigate({
      search: (previous) => ({
        ...previous,
        playType: next === playType ? undefined : next,
      }),
    })
  }

  const frozen = mayBeFrozen(queryClient)

  return (
    <Section title={t('title')} description={t('tagline')} className="space-y-8">
      <PlayTypeList
        summary={summary.data}
        error={summary.error}
        frozen={frozen}
        onRetry={() => void summary.refetch()}
        teamName={teamName}
        label={label}
        selected={playType}
        onSelect={drillIn}
      />

      {playType === undefined ? null : (
        <Section
          headingLevel={3}
          title={t('scenes.title', { playType: label('playType', playType) })}
        >
          <PlaySceneList
            plays={plays}
            error={allPlays.error}
            frozen={frozen}
            onRetry={() => void allPlays.refetch()}
            teamName={teamName}
            label={label}
            selectedId={selectedPlay?.event_id ?? null}
            onSelect={(play) => selection.select(play && playItemId(play.event_id))}
          />

          {selectedPlay === null ? null : (
            <Section headingLevel={3} title={t('trajectory.title')} className="pt-4">
              <PlayTrajectory
                play={selectedPlay}
                playType={label('playType', selectedPlay.play_type)}
                team={teamName(selectedPlay.team)}
              />
            </Section>
          )}
        </Section>
      )}
    </Section>
  )
}
