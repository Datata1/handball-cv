import {
  detectionRates,
  formatCount,
  formatRate,
  keyFigures,
  possessionSplit,
} from '../figures'
import { stats, unmeasuredStats } from '../stories/overview'

describe('keyFigures', () => {
  it('passes through what was measured', () => {
    expect(keyFigures(stats)).toEqual({
      frames: 60_000,
      durationSeconds: 2_400,
      tracks: 34,
    })
  })

  // `total_frames: 0` is the row the read freeze leaves; nothing derived from
  // it is a measurement.
  it('reports nothing for a match no frame was read for', () => {
    expect(keyFigures(unmeasuredStats)).toEqual({
      frames: null,
      durationSeconds: null,
      tracks: null,
    })
  })
})

describe('detectionRates', () => {
  it('passes the three rates through', () => {
    expect(detectionRates(stats)).toEqual({ ball: 71.4, player: 98.2, field: 86.5 })
  })

  it('refuses the zeros the backend writes when it divided by no frames', () => {
    expect(detectionRates(unmeasuredStats)).toEqual({
      ball: null,
      player: null,
      field: null,
    })
  })
})

describe('possessionSplit', () => {
  it('names the share that belongs to neither team', () => {
    expect(possessionSplit(stats)).toEqual({ a: 54.3, b: 41.2, unassigned: 4.5 })
  })

  it('leaves nothing unassigned when the two add up', () => {
    expect(
      possessionSplit({ ...stats, possession_a: 57.5, possession_b: 42.5 }),
    ).toEqual({ a: 57.5, b: 42.5, unassigned: 0 })
  })

  // Both are 0.0 when no frame had a ball holder at all — the legacy
  // `(a + b) > 0` guard, which was the one thing that screen got right.
  it('is null when no possession was measured', () => {
    expect(possessionSplit(unmeasuredStats)).toBeNull()
  })
})

describe('formatting', () => {
  it('groups a frame count the German way', () => {
    expect(formatCount(60_000, 'de')).toBe('60.000')
  })

  it('keeps one decimal on a rate, with a comma', () => {
    expect(formatRate(71.4, 'de')).toBe('71,4')
    expect(formatRate(100, 'de')).toBe('100')
  })
})
