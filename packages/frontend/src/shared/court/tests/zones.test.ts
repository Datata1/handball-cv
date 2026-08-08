import { COURT_LENGTH_M, COURT_WIDTH_M } from '../geometry'
import { courtZone, ZONE_CODES, zonesForHalf } from '../zones'

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
