import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { DensityMap } from '@/features/heatmap/components/DensityMap'
import { HeatmapControls } from '@/features/heatmap/components/HeatmapControls'
import { PointSummary } from '@/features/heatmap/components/PointSummary'
import { TimeWindow } from '@/features/heatmap/components/TimeWindow'
import { TrackFilter } from '@/features/heatmap/components/TrackFilter'
import { ZoneTiles } from '@/features/heatmap/components/ZoneTiles'
import {
  heatmapFilters,
  isFiltered,
  phaseFromSelection,
} from '@/features/heatmap/filters'
import { useHeatmapPoints } from '@/features/heatmap/queries'
import { useMatchMeta, useTeamPhases } from '@/features/report/queries'
import { heatmapDefaults, heatmapSearch } from '@/features/report/search'
import { teamNamer } from '@/features/report/teams'
import { phaseIdFromItem, phaseItemId } from '@/features/report/timeline'
import { matchDurationSeconds } from '@/features/report/video'
import { useBackendLabel } from '@/i18n/backend-label'
import { matchStatsOptions } from '@/shared/matches'
import { mayBeFrozen } from '@/shared/query'
import { ErrorState, Section } from '@/shared/ui'
import { formatClock } from '@/shared/video'
import { usePlayer, useSelection } from '@/stores'

export const Route = createFileRoute('/matches/$matchId/heatmap')({
  validateSearch: heatmapSearch,
  search: { middlewares: [stripSearchParams(heatmapDefaults)] },
  // An `observer` because the phase this section filters on is picked on the
  // shared timeline: the shell draws it, and the selection store is what reaches
  // across the `<Outlet/>`.
  component: observer(HeatmapSection),
})

/**
 * Where the players were, either as the six zones of each half or as the point
 * cloud the filters below narrow.
 *
 * Every control is a search param, so the whole analysis is one link — the
 * legacy version held seven of them in seven `useState`s, and a reload lost all
 * of it. The two sources are deliberately different: the tiles summarise the
 * match from `/stats` and take no filters at all, while the cloud is
 * `/heatmap-points` and takes all of them.
 */
function HeatmapSection() {
  const { matchId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { t } = useTranslation('heatmap')
  const queryClient = useQueryClient()
  const player = usePlayer()
  const selection = useSelection()
  const label = useBackendLabel()

  const tiles = search.mode === 'tiles'

  const meta = useMatchMeta(matchId)
  const phases = useTeamPhases(matchId)
  const stats = useQuery({ ...matchStatsOptions(matchId), enabled: tiles })
  const filters = useMemo(() => heatmapFilters(search), [search])
  const points = useHeatmapPoints(matchId, filters, !tiles)

  const match = meta.data ?? null
  const teamName = useMemo(
    () =>
      teamNamer(match ?? { team_a_name: null, team_b_name: null }, (value) =>
        label('team', value),
      ),
    [match, label],
  )

  const phase = phases.data?.find((item) => item.phase_id === search.phase) ?? null

  // The filter is the id in the URL, so it is named even before the phase list
  // has answered — the alternative is a chip claiming the whole match while the
  // request is scoped to one phase.
  const phaseLabel =
    phase === null
      ? search.phase === undefined
        ? null
        : t('phase.number', { id: search.phase })
      : t('phase.current', {
          team: teamName(phase.offense_team),
          type: label('phase', phase.phase_type),
          start: formatClock(phase.start_time_s),
          end: formatClock(phase.end_time_s),
        })

  // The URL is the truth and the store mirrors it, so back and forward move the
  // timeline's highlight with the filter.
  useEffect(() => {
    if (search.phase !== undefined) {
      selection.select(phaseItemId(search.phase))
      return
    }

    if (phaseIdFromItem(selection.timelineItemId) !== null) selection.clear()
  }, [search.phase, selection])

  // …and back, for the picks a trainer makes on the timeline itself. Only a
  // genuine selection change may navigate: re-running this after the URL moved
  // would push the entry the back button just left.
  const lastItemId = useRef<string | null>(null)

  useEffect(() => {
    const itemId = selection.timelineItemId
    if (itemId === lastItemId.current) return

    const next = phaseFromSelection(lastItemId.current, itemId, search.phase)
    lastItemId.current = itemId

    if (next !== search.phase) {
      void navigate({ search: (previous) => ({ ...previous, phase: next }) })
    }
  }, [selection.timelineItemId, search.phase, navigate])

  const clipStart = phase?.start_time_s ?? null
  const clipEnd = phase?.end_time_s ?? null

  // The clip follows the filter: while the heatmap shows one phase, the player
  // plays that phase. It is released the moment there isn't one, or a clip would
  // outlive the section that set it.
  useEffect(() => {
    if (clipStart === null || clipEnd === null) {
      player.clearClip()
      return
    }

    player.setClip({ start: clipStart, end: clipEnd })
    player.seek(clipStart)

    return () => player.clearClip()
  }, [clipStart, clipEnd, player])

  const duration = match === null ? 0 : matchDurationSeconds(match)
  const bounds = phase
    ? { start: phase.start_time_s, end: phase.end_time_s }
    : { start: 0, end: duration }

  const frozen = mayBeFrozen(queryClient)

  return (
    <Section title={t('title')} description={t('tagline')} className="space-y-8">
      <HeatmapControls
        mode={search.mode}
        perspective={search.perspective}
        phaseLabel={phaseLabel}
        onModeChange={(mode) =>
          void navigate({ search: (previous) => ({ ...previous, mode }) })
        }
        onPerspectiveChange={(perspective) =>
          void navigate({ search: (previous) => ({ ...previous, perspective }) })
        }
        onClearPhase={() =>
          void navigate({ search: (previous) => ({ ...previous, phase: undefined }) })
        }
      />

      {tiles ? (
        <ZoneTiles
          stats={stats.data}
          error={stats.error}
          frozen={frozen}
          onRetry={() => void stats.refetch()}
          label={label}
          teamName={teamName}
        />
      ) : points.error ? (
        // One request feeds both the picker and the cloud, so it reports its
        // failure once rather than in each of them.
        <ErrorState
          error={points.error}
          processing={frozen}
          onRetry={() => void points.refetch()}
        />
      ) : (
        <>
          <TrackFilter
            tracks={points.data?.available_track_ids}
            selected={search.tracks}
            // Narrowing a list is a way of reading it, not a step to undo: four
            // ticks would otherwise be four presses of the back button.
            onChange={(tracks) =>
              void navigate({
                search: (previous) => ({ ...previous, tracks }),
                replace: true,
              })
            }
            teamName={teamName}
          />

          {bounds.end > bounds.start ? (
            <TimeWindow
              bounds={bounds}
              from={search.from}
              to={search.to}
              onChange={(window) =>
                void navigate({
                  search: (previous) => ({
                    ...previous,
                    from: window?.from,
                    to: window?.to,
                  }),
                  replace: true,
                })
              }
            />
          ) : null}

          <PointSummary
            points={points.data?.heatmap_points}
            filtered={isFiltered(search)}
          />

          <DensityMap
            points={points.data?.heatmap_points ?? []}
            teamName={teamName}
            label={label}
          />
        </>
      )}
    </Section>
  )
}
