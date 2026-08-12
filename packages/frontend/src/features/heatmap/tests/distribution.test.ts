import type { HeatmapPoint } from '@/shared/api'
import { ZONE_CODES } from '@/shared/court'

import {
  busiestZones,
  teamsPresent,
  teamTotals,
  zoneDistribution,
} from '../distribution'

const POINTS: HeatmapPoint[] = [
  // Left half: the wing, the back court and the pivot.
  { x: 4.5, y: 16.5, team: 'A' },
  { x: 4.5, y: 16.5, team: 'A' },
  { x: 4.5, y: 16.5, team: 'B' },
  { x: 10.5, y: 10, team: 'B' },
  { x: 3, y: 10, team: 'U' },
  // Right half, which is the left one turned about the centre point.
  { x: 35.5, y: 3.5, team: 'A' },
]

describe('zoneDistribution', () => {
  it('reports both halves, always in the order the tiles list them', () => {
    const zones = zoneDistribution([])

    expect(zones).toHaveLength(12)
    expect(zones.slice(0, 6).map((zone) => zone.zone)).toEqual([...ZONE_CODES])
    expect(zones.every((zone) => zone.total === 0)).toBe(true)
  })

  it('counts a position into the zone the backend would have counted it in', () => {
    const zones = zoneDistribution(POINTS)
    const zone = (half: string, code: string) =>
      zones.find((entry) => entry.half === half && entry.zone === code)

    expect(zone('left', 'LA')?.counts).toEqual({ A: 2, B: 1, U: 0 })
    expect(zone('left', 'RM')?.total).toBe(1)
    expect(zone('left', 'KL')?.counts.U).toBe(1)
    expect(zone('right', 'LA')?.counts.A).toBe(1)
  })

  it('counts every point exactly once', () => {
    const total = zoneDistribution(POINTS).reduce((sum, zone) => sum + zone.total, 0)

    expect(total).toBe(POINTS.length)
  })
})

describe('busiestZones', () => {
  it('names the busiest first and leaves out the ones nothing was measured in', () => {
    const busiest = busiestZones(zoneDistribution(POINTS), 4)

    expect(busiest[0]).toMatchObject({ half: 'left', zone: 'LA', total: 3 })
    expect(busiest).toHaveLength(4)
    expect(busiest.every((zone) => zone.total > 0)).toBe(true)
  })

  it('has nothing to name for an empty cloud', () => {
    expect(busiestZones(zoneDistribution([]), 4)).toEqual([])
  })
})

describe('teamTotals', () => {
  it('counts each bucket, and lists only the buckets that are there', () => {
    const totals = teamTotals(POINTS)

    expect(totals).toEqual({ A: 3, B: 2, U: 1 })
    expect(teamsPresent(totals)).toEqual(['A', 'B', 'U'])
    expect(teamsPresent({ A: 4, B: 0, U: 0 })).toEqual(['A'])
  })
})
