import { COURT_LENGTH_M, COURT_WIDTH_M } from './geometry'
import type { CourtPoint } from './projection'

/**
 * The six attacking positions `/stats` reports per court half, in the fixed
 * order it returns them. Labels come from the i18n `domain` namespace under
 * `zone`, through `useBackendLabel` — the codes are the backend's vocabulary,
 * not ours.
 */
export const ZONE_CODES = ['LA', 'RL', 'RM', 'RR', 'RA', 'KL'] as const

export type ZoneCode = (typeof ZONE_CODES)[number]

export type CourtHalf = 'left' | 'right'

export type CourtZone = {
  half: CourtHalf
  code: ZoneCode
  /** Where the zone's activity is drawn, in court metres. */
  centre: CourtPoint
  /** Radius the density view splats a zone's summary over, in metres. */
  spread: number
}

/**
 * Centres are drawing seeds for a zone summary, not places a player stands —
 * `KL` deliberately sits inside the goal area, where the summary of everything
 * happening at the 6 m line reads best.
 */
const LEFT_CENTRES: Record<ZoneCode, CourtPoint> = {
  LA: { x: 4.57, y: 16.1 },
  RL: { x: 10.43, y: 13.33 },
  RM: { x: 10.65, y: 10 },
  RR: { x: 10.43, y: 6.67 },
  RA: { x: 4.57, y: 3.9 },
  KL: { x: 2.61, y: 10 },
}

const SPREADS: Record<ZoneCode, number> = {
  LA: 0.96,
  RL: 1.09,
  RM: 1.3,
  RR: 1.09,
  RA: 0.96,
  KL: 0.78,
}

/** The right half is the left half turned about the centre point, not mirrored. */
function reflect(point: CourtPoint): CourtPoint {
  return { x: COURT_LENGTH_M - point.x, y: COURT_WIDTH_M - point.y }
}

function centreFor(half: CourtHalf, code: ZoneCode): CourtPoint {
  const left = LEFT_CENTRES[code]
  return half === 'left' ? left : reflect(left)
}

export function courtZone(half: CourtHalf, code: ZoneCode): CourtZone {
  return { half, code, centre: centreFor(half, code), spread: SPREADS[code] }
}

/** All six zones of one half, in the order `/stats` returns them. */
export function zonesForHalf(half: CourtHalf): CourtZone[] {
  return ZONE_CODES.map((code) => courtZone(half, code))
}

/**
 * `/stats` groups positions into zones with a SQL `CASE` per half — first
 * branch wins, and the halfway line decides which half a position belongs to.
 * These are those branches (`backend/routes/matches.py:389`).
 */
function leftCode({ x, y }: CourtPoint): ZoneCode {
  if (x < 7 && y >= 5 && y <= 15) return 'KL'
  if (x < 12 && y >= 15) return 'LA'
  if (x < 12 && y <= 5) return 'RA'
  if (y > 12) return 'RL'
  if (y < 8) return 'RR'

  return 'RM'
}

function rightCode({ x, y }: CourtPoint): ZoneCode {
  if (x > 33 && y >= 5 && y <= 15) return 'KL'
  if (x > 28 && y <= 5) return 'LA'
  if (x > 28 && y >= 15) return 'RA'
  if (y < 8) return 'RL'
  if (y > 12) return 'RR'

  return 'RM'
}

/**
 * The zone a single position falls in.
 *
 * A deliberate copy of the server's own grouping: a client-side summary of the
 * points has to bucket them the way `/stats` bucketed the ones behind the
 * tiles, or the two views would describe the same match differently.
 */
export function zoneAt(point: CourtPoint): CourtZone {
  const half: CourtHalf = point.x < COURT_LENGTH_M / 2 ? 'left' : 'right'

  return courtZone(half, half === 'left' ? leftCode(point) : rightCode(point))
}
