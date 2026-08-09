/**
 * The physical handball court, in metres. Every number here is a rule-book
 * dimension, and every path is expressed in court coordinates — `x ∈ [0, 40]`
 * runs goal to goal, `y ∈ [0, 20]` runs sideline to sideline. That is the same
 * frame the backend reports positions in, so nothing in this module converts.
 */

export const COURT_LENGTH_M = 40
export const COURT_WIDTH_M = 20

/** Drawn beyond the goal line, so the goals sit in the viewBox margin. */
export const GOAL_DEPTH_M = 1
export const GOAL_WIDTH_M = 3

export const GOAL_AREA_RADIUS_M = 6
export const FREE_THROW_RADIUS_M = 9
export const PENALTY_DISTANCE_M = 7
export const PENALTY_MARK_LENGTH_M = 1
export const KEEPER_LINE_DISTANCE_M = 4
export const KEEPER_LINE_LENGTH_M = 0.15

/** Room for the goals and for a marker sitting on a boundary line. */
export const COURT_MARGIN_M = 1.5

export type CourtEnd = 'left' | 'right'

/** Inner edge of the near goalpost — both arc centres sit here. */
export const GOAL_POST_NEAR_Y = (COURT_WIDTH_M - GOAL_WIDTH_M) / 2
export const GOAL_POST_FAR_Y = (COURT_WIDTH_M + GOAL_WIDTH_M) / 2

export const COURT_ENDS: readonly CourtEnd[] = ['left', 'right']

/** `x` of the goal line at this end. */
export function goalLineX(end: CourtEnd): number {
  return end === 'left' ? 0 : COURT_LENGTH_M
}

/** +1 towards the centre circle from the left end, -1 from the right. */
function inward(end: CourtEnd): 1 | -1 {
  return end === 'left' ? 1 : -1
}

function round(value: number): number {
  return Number(value.toFixed(3))
}

/**
 * Goal-area and free-throw lines share one shape: a quarter arc from each
 * goalpost, joined by a straight segment the width of the goal. Only the radius
 * differs — which is also why the 6 m line meets the goal line while the 9 m
 * line, whose radius exceeds the distance to the sideline, runs off the side
 * instead.
 */
export function endLinePath(radius: number, end: CourtEnd): string {
  const originX = goalLineX(end)
  const direction = inward(end)
  // SVG's positive sweep direction is clockwise on screen (y grows downward),
  // which traces the left end's arcs but runs backwards at the right end.
  const sweep = end === 'left' ? 1 : 0

  const reachesGoalLine = radius <= GOAL_POST_NEAR_Y
  const startX = reachesGoalLine
    ? originX
    : originX + direction * Math.sqrt(radius ** 2 - GOAL_POST_NEAR_Y ** 2)
  const startY = reachesGoalLine ? GOAL_POST_NEAR_Y - radius : 0

  const apexX = originX + direction * radius

  return [
    `M ${round(startX)} ${round(startY)}`,
    `A ${radius} ${radius} 0 0 ${sweep} ${round(apexX)} ${GOAL_POST_NEAR_Y}`,
    `L ${round(apexX)} ${GOAL_POST_FAR_Y}`,
    `A ${radius} ${radius} 0 0 ${sweep} ${round(startX)} ${round(COURT_WIDTH_M - startY)}`,
  ].join(' ')
}

/** The goal itself, drawn outside the goal line. */
export function goalRect(end: CourtEnd): {
  x: number
  y: number
  width: number
  height: number
} {
  return {
    x: end === 'left' ? -GOAL_DEPTH_M : COURT_LENGTH_M,
    y: GOAL_POST_NEAR_Y,
    width: GOAL_DEPTH_M,
    height: GOAL_WIDTH_M,
  }
}

/** A short line parallel to the goal line, `distance` metres in front of it. */
export function endMark(
  end: CourtEnd,
  distance: number,
  length: number,
): { x: number; y1: number; y2: number } {
  const x = goalLineX(end) + inward(end) * distance
  return {
    x,
    y1: COURT_WIDTH_M / 2 - length / 2,
    y2: COURT_WIDTH_M / 2 + length / 2,
  }
}
