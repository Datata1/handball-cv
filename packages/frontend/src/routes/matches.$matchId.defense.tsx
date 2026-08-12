import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { FormationDistribution } from '@/features/defense/components/FormationDistribution'
import { SceneList } from '@/features/defense/components/SceneList'
import { scenesFor } from '@/features/defense/formations'
import { useFormationSummary } from '@/features/defense/queries'
import { useFormationScenes, useMatchMeta } from '@/features/report/queries'
import { defenseSearch } from '@/features/report/search'
import { teamNamer } from '@/features/report/teams'
import { formationItemId } from '@/features/report/timeline'
import { useBackendLabel } from '@/i18n/backend-label'
import { mayBeFrozen } from '@/shared/query'
import { Section } from '@/shared/ui'
import { usePlayer, useSelection } from '@/stores'

export const Route = createFileRoute('/matches/$matchId/defense')({
  validateSearch: defenseSearch,
  // An `observer` because the scene this section points at is held in the
  // selection store: the shell draws the timeline it highlights on, and the
  // store is what reaches across the `<Outlet/>`.
  component: observer(DefenseSection),
})

/** Which defensive shapes a team used, how often, and every scene of one. */
function DefenseSection() {
  const { matchId } = Route.useParams()
  const { team, formation } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { t } = useTranslation('defense')
  const queryClient = useQueryClient()
  const player = usePlayer()
  const selection = useSelection()
  const label = useBackendLabel()

  const meta = useMatchMeta(matchId)
  const summary = useFormationSummary(matchId)
  // Every scene of the match, loaded once by the shell for the timeline. The
  // endpoint's own `?team&formation` would describe the same rows a second time.
  const allScenes = useFormationScenes(matchId)

  const match = meta.data ?? null
  const teamName = useMemo(
    () =>
      teamNamer(match ?? { team_a_name: null, team_b_name: null }, (value) =>
        label('team', value),
      ),
    [match, label],
  )

  const scenes = useMemo(
    () =>
      formation === undefined || allScenes.data === undefined
        ? undefined
        : scenesFor(allScenes.data, { team, formation }),
    [allScenes.data, team, formation],
  )

  // What the report is pointing at, if it is one of the scenes on screen. The
  // timeline highlights it too — the shell drew the item, this named it.
  const selectedScene =
    scenes?.find(
      (scene) => formationItemId(scene.scene_id) === selection.timelineItemId,
    ) ?? null

  const clipStart = selectedScene?.start_time_s ?? null
  const clipEnd = selectedScene?.end_time_s ?? null

  // The clip is a function of the selected scene, so it is released the moment
  // there isn't one: the pick cleared, the drill-in changed, the section left.
  // A clip that outlived its scene would confine playback elsewhere in the
  // report with nothing on screen to say why.
  useEffect(() => {
    if (clipStart === null || clipEnd === null) {
      player.clearClip()
      return
    }

    player.setClip({ start: clipStart, end: clipEnd })
    // `setClip` only moves the playhead when it sits outside the scene, and a
    // trainer who picked a scene wants it from the top either way.
    player.seek(clipStart)

    return () => player.clearClip()
  }, [clipStart, clipEnd, player])

  // Pushed, not replaced: drilling into a formation is a step a trainer takes
  // and expects the back button to undo.
  function drillIn(nextTeam: string, nextFormation: string) {
    const same = nextTeam === team && nextFormation === formation

    void navigate({
      search: (previous) => ({
        ...previous,
        team: same ? undefined : nextTeam,
        formation: same ? undefined : nextFormation,
      }),
    })
  }

  const frozen = mayBeFrozen(queryClient)

  return (
    <Section title={t('title')} description={t('tagline')} className="space-y-8">
      <FormationDistribution
        summary={summary.data}
        error={summary.error}
        frozen={frozen}
        onRetry={() => void summary.refetch()}
        teamName={teamName}
        label={label}
        selected={{ team, formation }}
        onSelect={drillIn}
      />

      {formation === undefined ? null : (
        <Section
          headingLevel={3}
          title={t('scenes.title', { formation: label('formation', formation) })}
          description={team === undefined ? undefined : teamName(team)}
        >
          <SceneList
            scenes={scenes}
            error={allScenes.error}
            frozen={frozen}
            onRetry={() => void allScenes.refetch()}
            selectedId={selectedScene?.scene_id ?? null}
            onSelect={(scene) =>
              selection.select(scene && formationItemId(scene.scene_id))
            }
          />
        </Section>
      )}
    </Section>
  )
}
