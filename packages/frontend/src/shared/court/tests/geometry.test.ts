import {
  COURT_ENDS,
  COURT_LENGTH_M,
  COURT_WIDTH_M,
  endLinePath,
  endMark,
  FREE_THROW_RADIUS_M,
  GOAL_AREA_RADIUS_M,
  GOAL_POST_FAR_Y,
  GOAL_POST_NEAR_Y,
  GOAL_WIDTH_M,
  goalLineX,
  goalRect,
  KEEPER_LINE_DISTANCE_M,
  KEEPER_LINE_LENGTH_M,
  PENALTY_DISTANCE_M,
  PENALTY_MARK_LENGTH_M,
} from '../geometry'

/**
 * The point each command in a path lands on. `M`, `A` and `L` all end in one
 * coordinate pair, so the last two numbers of a command are that point.
 */
function coordinates(path: string): { x: number; y: number }[] {
  return path
    .trim()
    .split(/(?=[MAL])/)
    .map((command) => command.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [])
    .filter((parts) => parts.length >= 2)
    .map((parts) => ({ x: parts[parts.length - 2], y: parts[parts.length - 1] }))
}

describe('court geometry', () => {
  it('centres the goal on the sideline axis', () => {
    expect(GOAL_POST_FAR_Y - GOAL_POST_NEAR_Y).toBe(GOAL_WIDTH_M)
    expect(GOAL_POST_NEAR_Y + GOAL_POST_FAR_Y).toBe(COURT_WIDTH_M)
  })

  it.each(COURT_ENDS)(
    'runs the 6 m line goal line to goal line at the %s end',
    (end) => {
      const points = coordinates(endLinePath(GOAL_AREA_RADIUS_M, end))
      const x = goalLineX(end)

      expect(points[0]).toEqual({ x, y: GOAL_POST_NEAR_Y - GOAL_AREA_RADIUS_M })
      expect(points[points.length - 1]).toEqual({
        x,
        y: COURT_WIDTH_M - (GOAL_POST_NEAR_Y - GOAL_AREA_RADIUS_M),
      })
    },
  )

  it.each(COURT_ENDS)('runs the 9 m line off the sidelines at the %s end', (end) => {
    const points = coordinates(endLinePath(FREE_THROW_RADIUS_M, end))
    const inset = Math.sqrt(FREE_THROW_RADIUS_M ** 2 - GOAL_POST_NEAR_Y ** 2)
    const x = goalLineX(end) + (end === 'left' ? inset : -inset)

    expect(points[0].x).toBeCloseTo(x, 3)
    expect(points[0].y).toBe(0)
    expect(points[points.length - 1].y).toBe(COURT_WIDTH_M)
  })

  it.each(COURT_ENDS)(
    'joins the arcs with the goal-width straight at the %s end',
    (end) => {
      const points = coordinates(endLinePath(GOAL_AREA_RADIUS_M, end))
      const apexX = goalLineX(end) + (end === 'left' ? 1 : -1) * GOAL_AREA_RADIUS_M

      expect(points[1]).toEqual({ x: apexX, y: GOAL_POST_NEAR_Y })
      expect(points[2]).toEqual({ x: apexX, y: GOAL_POST_FAR_Y })
    },
  )

  it.each(COURT_ENDS)('keeps every marking inside the court at the %s end', (end) => {
    const penalty = endMark(end, PENALTY_DISTANCE_M, PENALTY_MARK_LENGTH_M)
    const keeper = endMark(end, KEEPER_LINE_DISTANCE_M, KEEPER_LINE_LENGTH_M)

    for (const mark of [penalty, keeper]) {
      expect(mark.x).toBeGreaterThan(0)
      expect(mark.x).toBeLessThan(COURT_LENGTH_M)
      expect(mark.y1).toBeGreaterThan(0)
      expect(mark.y2).toBeLessThan(COURT_WIDTH_M)
    }

    expect(penalty.y2 - penalty.y1).toBe(PENALTY_MARK_LENGTH_M)
    expect(keeper.y2 - keeper.y1).toBeCloseTo(KEEPER_LINE_LENGTH_M, 10)
  })

  it.each(COURT_ENDS)('hangs the goal outside the goal line at the %s end', (end) => {
    const goal = goalRect(end)

    expect(goal.height).toBe(GOAL_WIDTH_M)
    expect(goal.y).toBe(GOAL_POST_NEAR_Y)

    if (end === 'left') {
      expect(goal.x + goal.width).toBe(0)
    } else {
      expect(goal.x).toBe(COURT_LENGTH_M)
    }
  })

  it('mirrors the two ends', () => {
    const left = coordinates(endLinePath(GOAL_AREA_RADIUS_M, 'left'))
    const right = coordinates(endLinePath(GOAL_AREA_RADIUS_M, 'right'))

    expect(right.map((p) => ({ x: COURT_LENGTH_M - p.x, y: p.y }))).toEqual(left)
  })
})
