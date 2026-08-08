import { type ReactNode, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useBackendLabel } from '@/i18n/backend-label'
import { cn } from '@/lib/utils'

import {
  COURT_ENDS,
  COURT_LENGTH_M,
  COURT_WIDTH_M,
  endLinePath,
  endMark,
  FREE_THROW_RADIUS_M,
  GOAL_AREA_RADIUS_M,
  goalRect,
  KEEPER_LINE_DISTANCE_M,
  KEEPER_LINE_LENGTH_M,
  PENALTY_DISTANCE_M,
  PENALTY_MARK_LENGTH_M,
} from './geometry'
import {
  type CourtOrientation,
  CourtProjectionContext,
  courtLayerTransform,
  courtViewBox,
  createCourtProjection,
  useCourtProjection,
} from './projection'
import { type CourtHalf, zonesForHalf } from './zones'

/** Line weights in metres. The court is chrome; the data drawn on it is not. */
const STROKE = { boundary: 0.14, marking: 0.1, dashed: 0.08 } as const

function CourtMarkings() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect
        x={0}
        y={0}
        width={COURT_LENGTH_M}
        height={COURT_WIDTH_M}
        className="fill-muted stroke-muted-foreground"
        strokeWidth={STROKE.boundary}
      />

      <line
        x1={COURT_LENGTH_M / 2}
        y1={0}
        x2={COURT_LENGTH_M / 2}
        y2={COURT_WIDTH_M}
        className="stroke-muted-foreground"
        strokeWidth={STROKE.marking}
      />

      {COURT_ENDS.map((end) => {
        const penalty = endMark(end, PENALTY_DISTANCE_M, PENALTY_MARK_LENGTH_M)
        const keeper = endMark(end, KEEPER_LINE_DISTANCE_M, KEEPER_LINE_LENGTH_M)
        const goal = goalRect(end)

        return (
          <g key={end}>
            <rect
              x={goal.x}
              y={goal.y}
              width={goal.width}
              height={goal.height}
              className="fill-primary/15 stroke-primary"
              strokeWidth={STROKE.marking}
            />

            <path
              d={endLinePath(GOAL_AREA_RADIUS_M, end)}
              className="stroke-muted-foreground"
              strokeWidth={STROKE.marking}
            />

            <path
              d={endLinePath(FREE_THROW_RADIUS_M, end)}
              className="stroke-muted-foreground/70"
              strokeWidth={STROKE.dashed}
              strokeDasharray="0.4 0.3"
            />

            <line
              x1={penalty.x}
              y1={penalty.y1}
              x2={penalty.x}
              y2={penalty.y2}
              className="stroke-muted-foreground"
              strokeWidth={STROKE.marking}
            />

            <line
              x1={keeper.x}
              y1={keeper.y1}
              x2={keeper.x}
              y2={keeper.y2}
              className="stroke-muted-foreground"
              strokeWidth={STROKE.marking}
            />
          </g>
        )
      })}
    </g>
  )
}

/**
 * Drawn through the projection rather than under `CourtLayer`, because the
 * layer's rotation would stand the labels on their side in the vertical court.
 */
function CourtZones({ halves }: { halves: CourtHalf | 'both' }) {
  const { toX, toY } = useCourtProjection()
  const label = useBackendLabel()

  const zones =
    halves === 'both'
      ? [...zonesForHalf('left'), ...zonesForHalf('right')]
      : zonesForHalf(halves)

  return (
    <g>
      {zones.map((zone) => {
        const x = toX(zone.centre)
        const y = toY(zone.centre)

        return (
          <g key={`${zone.half}-${zone.code}`}>
            <circle cx={x} cy={y} r={0.3} className="fill-muted-foreground" />
            <text
              x={x}
              y={y + 1.4}
              textAnchor="middle"
              fontSize={0.85}
              className="fill-muted-foreground"
            >
              {label('zone', zone.code)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/**
 * A group whose children are positioned in **court metres**, whichever way the
 * court is turned. Everything drawn on the court belongs in one of these; only
 * upright text and HTML overlays need `useCourtProjection` instead.
 */
export function CourtLayer({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const { orientation } = useCourtProjection()

  return (
    <g className={className} transform={courtLayerTransform(orientation)}>
      {children}
    </g>
  )
}

/**
 * What a consumer draws on the court. The three travel together on purpose: the
 * SVG is a single `role="img"`, so nothing inside `layer` reaches a screen
 * reader, and a picture that cannot be named or described has no business being
 * drawn.
 */
export type CourtData = {
  /** Names the court as a whole — what is drawn, not that it is a court. */
  label: string
  /** Positioned in metres. Put it in a `<CourtLayer>` unless it is text. */
  layer: ReactNode
  /** The same information as prose or a table, for readers who cannot see it. */
  alternative: ReactNode
}

export type CourtProps = {
  orientation?: CourtOrientation
  /** Overlay the six `/stats` zones of one half, or of both. */
  zones?: CourtHalf | 'both'
  data?: CourtData
  className?: string
}

/** The one handball court. Fills its container; consumers work in metres. */
export function Court({
  orientation = 'horizontal',
  zones,
  data,
  className,
}: CourtProps) {
  const { t } = useTranslation()
  const projection = useMemo(() => createCourtProjection(orientation), [orientation])

  return (
    <CourtProjectionContext.Provider value={projection}>
      <figure className={cn('w-full', className)}>
        <svg
          viewBox={courtViewBox(orientation)}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={data?.label ?? t('court.label')}
          className="block h-auto w-full"
        >
          <CourtLayer>
            <CourtMarkings />
          </CourtLayer>
          {zones ? <CourtZones halves={zones} /> : null}
          {data?.layer}
        </svg>

        {data ? <figcaption className="sr-only">{data.alternative}</figcaption> : null}
      </figure>
    </CourtProjectionContext.Provider>
  )
}
