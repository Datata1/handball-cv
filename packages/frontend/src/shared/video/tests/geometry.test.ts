import { MIN_BAR_WIDTH_PERCENT, timeBar, timeOffset } from '../geometry'

describe('timeOffset', () => {
  it('is the fraction of the match that has passed', () => {
    expect(timeOffset(900, 3_600)).toBe(25)
  })

  it('clamps a time outside the match rather than drawing off the lane', () => {
    expect(timeOffset(-10, 3_600)).toBe(0)
    expect(timeOffset(4_000, 3_600)).toBe(100)
  })

  it('collapses to the start before a duration is known', () => {
    expect(timeOffset(42, 0)).toBe(0)
    expect(timeOffset(42, Number.NaN)).toBe(0)
  })
})

describe('timeBar', () => {
  it('places a bar at its share of the match', () => {
    expect(timeBar(900, 1_800, 3_600)).toEqual({ left: 25, width: 25 })
  })

  it('widens a bar too short to see or hit', () => {
    const bar = timeBar(1_000, 1_002, 3_600)

    expect(bar.left).toBeCloseTo(27.78, 2)
    expect(bar.width).toBe(MIN_BAR_WIDTH_PERCENT)
  })

  it('pulls a widened bar back inside the lane at the final whistle', () => {
    const bar = timeBar(3_599, 3_600, 3_600)

    expect(bar.width).toBe(MIN_BAR_WIDTH_PERCENT)
    expect(bar.left + bar.width).toBe(100)
  })

  it('does not let a reversed interval invert the bar', () => {
    expect(timeBar(1_800, 900, 3_600).width).toBe(MIN_BAR_WIDTH_PERCENT)
  })
})
