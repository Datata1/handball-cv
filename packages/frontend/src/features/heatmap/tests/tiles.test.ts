import { ZONE_CODES } from '@/shared/court'
import { stats, unmeasuredStats } from '../stories/heatmap'
import { hasZoneActivity, INVERT_AT, teamShare, tileFill, zoneTiles } from '../tiles'

describe('zoneTiles', () => {
  it('returns the six zones of a half in the fixed order', () => {
    expect(zoneTiles(stats, 'left').map((tile) => tile.zone)).toEqual([...ZONE_CODES])
  })

  // Two arrays, two field names, two meanings — a tile needs both and neither
  // can be derived from the other.
  it('carries the normalised intensity and the absolute counts side by side', () => {
    const [leftWing] = zoneTiles(stats, 'left')

    expect(leftWing.intensity).toBe(100)
    expect(leftWing.counts).toEqual({ A: 1_820, B: 90, U: 40 })
    expect(leftWing.total).toBe(1_950)
  })

  it('reads each half from its own pair of arrays', () => {
    const left = zoneTiles(stats, 'left')
    const right = zoneTiles(stats, 'right')

    expect(left[0].counts.A).toBe(1_820)
    expect(right[0].counts.A).toBe(110)
  })

  // The two arrays are built from one server-side list today. A tile that took
  // its count from the neighbouring zone would look exactly like real data.
  it('matches counts to intensities by zone code, not by position', () => {
    const shuffled = {
      ...stats,
      heatmap_left: [...stats.heatmap_left].reverse() as typeof stats.heatmap_left,
    }

    const [leftWing] = zoneTiles(shuffled, 'left')

    expect(leftWing.zone).toBe('LA')
    expect(leftWing.intensity).toBe(100)
  })
})

describe('hasZoneActivity', () => {
  it('is false when every zone of the half is a zero', () => {
    expect(hasZoneActivity(zoneTiles(unmeasuredStats, 'left'))).toBe(false)
  })

  it('is true as soon as one zone was measured', () => {
    expect(hasZoneActivity(zoneTiles(stats, 'left'))).toBe(true)
  })
})

describe('teamShare', () => {
  it('is a share of the zone, not of the match', () => {
    const [leftWing] = zoneTiles(stats, 'left')

    expect(teamShare(leftWing, 'A')).toBeCloseTo(1_820 / 1_950)
  })

  it('is zero rather than NaN for a zone nobody was seen in', () => {
    const [empty] = zoneTiles(unmeasuredStats, 'left')

    expect(teamShare(empty, 'A')).toBe(0)
  })
})

describe('tileFill', () => {
  it('never renders a zone as no fill at all', () => {
    expect(tileFill(0).mix).toBeGreaterThan(0)
  })

  it('rises with the intensity', () => {
    expect(tileFill(20).mix).toBeLessThan(tileFill(80).mix)
    expect(tileFill(100).mix).toBe(100)
  })

  // The value is the only text on the fill, and it flips before the fill gets
  // dark enough to swallow the card's own foreground.
  it('flips the value to the fill’s foreground once the fill is strong', () => {
    expect(tileFill(10).inverted).toBe(false)
    expect(tileFill(100).inverted).toBe(true)
    expect(tileFill(INVERT_AT).inverted).toBe(true)
  })

  it('clamps an intensity outside 0–100', () => {
    expect(tileFill(-5)).toEqual(tileFill(0))
    expect(tileFill(140)).toEqual(tileFill(100))
  })
})
