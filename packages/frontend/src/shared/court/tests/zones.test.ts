import { COURT_LENGTH_M, COURT_WIDTH_M } from '../geometry'
import type { CourtPoint } from '../projection'
import { courtZone, ZONE_CODES, zoneAt, zonesForHalf } from '../zones'

describe('court zones', () => {
  it('carries the six /stats zones in the order the backend returns them', () => {
    expect(zonesForHalf('left').map((zone) => zone.code)).toEqual([
      'LA',
      'RL',
      'RM',
      'RR',
      'RA',
      'KL',
    ])
  })

  it.each(['left', 'right'] as const)('keeps every %s centre on the court', (half) => {
    for (const zone of zonesForHalf(half)) {
      expect(zone.centre.x).toBeGreaterThan(0)
      expect(zone.centre.x).toBeLessThan(COURT_LENGTH_M)
      expect(zone.centre.y).toBeGreaterThan(0)
      expect(zone.centre.y).toBeLessThan(COURT_WIDTH_M)
    }
  })

  it('keeps each half in its own half of the court', () => {
    for (const zone of zonesForHalf('left')) {
      expect(zone.centre.x).toBeLessThan(COURT_LENGTH_M / 2)
    }
    for (const zone of zonesForHalf('right')) {
      expect(zone.centre.x).toBeGreaterThan(COURT_LENGTH_M / 2)
    }
  })

  it.each(ZONE_CODES)(
    'turns %s into the other half rather than mirroring it',
    (code) => {
      const left = courtZone('left', code)
      const right = courtZone('right', code)

      expect(right.centre.x).toBeCloseTo(COURT_LENGTH_M - left.centre.x, 10)
      expect(right.centre.y).toBeCloseTo(COURT_WIDTH_M - left.centre.y, 10)
    },
  )

  it('spreads a zone by a positive distance in metres', () => {
    for (const zone of zonesForHalf('left')) {
      expect(zone.spread).toBeGreaterThan(0)
      expect(zone.spread).toBeLessThan(COURT_WIDTH_M / 4)
    }
  })

  it('gives both halves of a zone the same spread', () => {
    for (const code of ZONE_CODES) {
      expect(courtZone('right', code).spread).toBe(courtZone('left', code).spread)
    }
  })
})

describe('zoneAt', () => {
  it('puts a position in the half it was measured in', () => {
    expect(zoneAt({ x: 5, y: 10 }).half).toBe('left')
    expect(zoneAt({ x: 35, y: 10 }).half).toBe('right')
    expect(zoneAt({ x: COURT_LENGTH_M / 2, y: 10 }).half).toBe('right')
  })

  // The centres are the seeds each zone's summary is drawn at, so a centre that
  // does not fall in its own zone would draw the summary somewhere else.
  it.each(['left', 'right'] as const)('finds every %s zone at its centre', (half) => {
    for (const zone of zonesForHalf(half)) {
      expect(zoneAt(zone.centre)).toMatchObject({ half, code: zone.code })
    }
  })

  const LEFT: [CourtPoint, string][] = [
    [{ x: 3, y: 10 }, 'KL'],
    [{ x: 10, y: 18 }, 'LA'],
    [{ x: 10, y: 2 }, 'RA'],
    [{ x: 15, y: 14 }, 'RL'],
    [{ x: 15, y: 6 }, 'RR'],
    [{ x: 15, y: 10 }, 'RM'],
  ]

  it.each(LEFT)('groups %o the way /stats groups it', (point, code) => {
    expect(zoneAt(point).code).toBe(code)

    // The right half is the left one turned about the centre point, and the
    // server's two `CASE`s say the same.
    const turned = { x: COURT_LENGTH_M - point.x, y: COURT_WIDTH_M - point.y }
    expect(zoneAt(turned).code).toBe(code)
  })
})
