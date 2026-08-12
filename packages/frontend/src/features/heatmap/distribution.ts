import type { HeatmapPoint, NormalisedTeam } from '@/shared/api'
import { type CourtHalf, ZONE_CODES, type ZoneCode, zoneAt } from '@/shared/court'

import { TEAM_BUCKETS } from './tiles'

/**
 * The cloud, counted by zone — what the canvas shows, in words.
 *
 * A density canvas reaches no screen reader, and the tiles cannot stand in for
 * it either: they summarise the whole match from `/stats` and take none of this
 * section's filters. So the drawn points are bucketed here, by the same rules
 * the server groups by, and the picture describes itself.
 */

export interface ZoneDensity {
  half: CourtHalf
  zone: ZoneCode
  counts: Record<NormalisedTeam, number>
  /** Positions counted in this zone, across all three buckets. */
  total: number
}

const HALVES: CourtHalf[] = ['left', 'right']

function noCounts(): Record<NormalisedTeam, number> {
  return { A: 0, B: 0, U: 0 }
}

/** Both halves' six zones, in the order the tiles list them. */
export function zoneDistribution(points: readonly HeatmapPoint[]): ZoneDensity[] {
  const zones = new Map<string, ZoneDensity>()

  for (const half of HALVES) {
    for (const zone of ZONE_CODES) {
      zones.set(`${half}-${zone}`, { half, zone, counts: noCounts(), total: 0 })
    }
  }

  for (const point of points) {
    const { half, code } = zoneAt(point)
    const entry = zones.get(`${half}-${code}`)
    if (entry === undefined) continue

    entry.counts[point.team] += 1
    entry.total += 1
  }

  return [...zones.values()]
}

/** The busiest zones first. A zone nothing was measured in is not one of them. */
export function busiestZones(
  distribution: readonly ZoneDensity[],
  limit: number,
): ZoneDensity[] {
  return distribution
    .filter((zone) => zone.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

/** How many positions each bucket contributed, for the legend beside the map. */
export function teamTotals(
  points: readonly HeatmapPoint[],
): Record<NormalisedTeam, number> {
  const totals = noCounts()
  for (const point of points) totals[point.team] += 1

  return totals
}

/** The buckets that are actually in the cloud, in the order the tiles read them. */
export function teamsPresent(totals: Record<NormalisedTeam, number>): NormalisedTeam[] {
  return TEAM_BUCKETS.filter((team) => totals[team] > 0)
}
