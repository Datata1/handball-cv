import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { TeamName } from '@/features/report/teams'
import type { BackendLabel } from '@/i18n/backend-label'
import { cn } from '@/lib/utils'
import type { HeatmapPoint } from '@/shared/api'
import { Court, type CourtData, type CourtOrientation } from '@/shared/court'

import { densitySize, renderDensity } from '../density'
import {
  busiestZones,
  teamsPresent,
  teamTotals,
  type ZoneDensity,
  zoneDistribution,
} from '../distribution'
import { readDensityPalette, TEAM_TONES } from '../palette'
import { TEAM_BUCKETS } from '../tiles'

/** Named in the text alternative; the rest of the twelve are in the tile view. */
const NAMED_ZONES = 4

function DensityCanvas({
  points,
  orientation,
}: {
  points: readonly HeatmapPoint[]
  orientation: CourtOrientation
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { width, height } = densitySize(orientation)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return

    // Read off the canvas itself, so a court inside a dark subtree draws in
    // that scheme's colours. Both are null under jsdom, which has no
    // rasteriser and no custom properties: there, the court renders alone.
    const ctx = canvas.getContext('2d')
    const palette = readDensityPalette(canvas)
    if (ctx === null || palette === null) return

    renderDensity(ctx, { points, palette, orientation })
  }, [points, orientation])

  return (
    // Hidden on the wrapper rather than on the canvas: the court underneath is
    // one role="img" carrying the description of both, so a second element in
    // the tree could only repeat it namelessly.
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <canvas ref={canvasRef} width={width} height={height} className="size-full" />
    </div>
  )
}

/**
 * Where the selected positions cluster, drawn on the shared court.
 *
 * The canvas sits over the court rather than in it: the drawing is a pixel
 * surface at a fixed resolution, stretched to whatever width the container
 * gives it, and its aspect ratio is the court's `viewBox` so the two line up
 * without either measuring the other.
 *
 * Emptiness is not this component's to report — `PointSummary` says what the
 * filters selected, including when that is nothing.
 */
export function DensityMap({
  points,
  teamName,
  label,
  orientation = 'horizontal',
  className,
}: {
  points: readonly HeatmapPoint[]
  teamName: TeamName
  /** Zone names are the backend's vocabulary, so the caller resolves them. */
  label: BackendLabel
  orientation?: CourtOrientation
  className?: string
}) {
  const { t } = useTranslation('heatmap')

  const totals = useMemo(() => teamTotals(points), [points])
  const busiest = useMemo(
    () => busiestZones(zoneDistribution(points), NAMED_ZONES),
    [points],
  )

  if (points.length === 0) return null

  const teams = teamsPresent(totals)

  const shares = (zone: ZoneDensity) =>
    TEAM_BUCKETS.filter((team) => zone.counts[team] > 0)
      .map((team) =>
        t('density.alternative.share', {
          team: teamName(team),
          count: zone.counts[team],
        }),
      )
      .join(', ')

  const data: CourtData = {
    label: t('density.label', { count: points.length }),
    layer: null,
    alternative: (
      <>
        <p>{t('density.alternative.intro', { count: points.length })}</p>
        <ul>
          {busiest.map((zone) => (
            <li key={`${zone.half}-${zone.zone}`}>
              {t('density.alternative.zone', {
                half: t(`tiles.${zone.half}`),
                zone: label('zone', zone.zone),
                count: zone.total,
                shares: shares(zone),
              })}
            </li>
          ))}
        </ul>
        <p>{t('density.alternative.tiles')}</p>
      </>
    ),
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <Court data={data} />
        <DensityCanvas points={points} orientation={orientation} />
      </div>

      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {teams.map((team) => (
          <li key={team} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn('size-2.5 rounded-full', TEAM_TONES[team])}
            />
            <span className="text-muted-foreground tabular-nums">
              {t('density.legend', { team: teamName(team), count: totals[team] })}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-center text-muted-foreground text-xs">{t('density.hint')}</p>
    </div>
  )
}
