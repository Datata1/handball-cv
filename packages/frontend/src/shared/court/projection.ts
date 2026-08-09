import { createContext, useContext } from 'react'

import { COURT_LENGTH_M, COURT_MARGIN_M, COURT_WIDTH_M } from './geometry'

export type CourtOrientation = 'horizontal' | 'vertical'

/** A position in court metres: `x ∈ [0, 40]` goal to goal, `y ∈ [0, 20]` across. */
export type CourtPoint = { x: number; y: number }

export type CourtProjection = {
  orientation: CourtOrientation
  /** SVG user-space x of a court point. */
  toX(point: CourtPoint): number
  /** SVG user-space y of a court point. */
  toY(point: CourtPoint): number
  /** Metres → SVG user units. Identical on both axes and in both orientations. */
  toLength(metres: number): number
  /** The `points` attribute of a `<polyline>` through `points`. */
  toPolyline(points: readonly CourtPoint[]): string
}

/**
 * The viewBox is measured in metres, so one user unit is one metre and scaling
 * is left entirely to `preserveAspectRatio`. That is what makes the projection
 * pure: it never reads a rendered size, so it is the same on the server, in a
 * test and in a 200px-wide container.
 */
export function courtViewBox(orientation: CourtOrientation): string {
  const [length, width] =
    orientation === 'horizontal'
      ? [COURT_LENGTH_M, COURT_WIDTH_M]
      : [COURT_WIDTH_M, COURT_LENGTH_M]

  return `${-COURT_MARGIN_M} ${-COURT_MARGIN_M} ${length + 2 * COURT_MARGIN_M} ${width + 2 * COURT_MARGIN_M}`
}

/**
 * The transform `CourtLayer` applies so its children can be written in raw
 * court metres. A rotation rather than a transpose — a transpose would mirror
 * the data drawn on top and swap the wings.
 */
export function courtLayerTransform(orientation: CourtOrientation): string | undefined {
  return orientation === 'horizontal'
    ? undefined
    : `translate(${COURT_WIDTH_M} 0) rotate(90)`
}

export function createCourtProjection(orientation: CourtOrientation): CourtProjection {
  const horizontal = orientation === 'horizontal'

  const toX = (point: CourtPoint) => (horizontal ? point.x : COURT_WIDTH_M - point.y)
  const toY = (point: CourtPoint) => (horizontal ? point.y : point.x)

  return {
    orientation,
    toX,
    toY,
    toLength: (metres) => metres,
    toPolyline: (points) =>
      points.map((point) => `${toX(point)},${toY(point)}`).join(' '),
  }
}

export const CourtProjectionContext = createContext<CourtProjection | null>(null)

/**
 * The projection of the enclosing `<Court>`. Reach for it when the orientation
 * transform would be wrong — upright text, an HTML overlay, hit testing.
 * Anything that can live under `<CourtLayer>` should, and skip this entirely.
 */
export function useCourtProjection(): CourtProjection {
  const projection = useContext(CourtProjectionContext)

  if (projection === null) {
    throw new Error('useCourtProjection must be used inside a <Court>')
  }

  return projection
}
