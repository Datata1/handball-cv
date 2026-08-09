import { formatClock } from '../time'

describe('formatClock', () => {
  it.each([
    [0, '00:00'],
    [7, '00:07'],
    [64, '01:04'],
    [724, '12:04'],
    // Minutes keep counting past the hour: a match is read as 72:13.
    [4_333, '72:13'],
  ])('renders %d seconds as %s', (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected)
  })

  it('floors rather than rounds, so a label never claims a frame that has not played', () => {
    expect(formatClock(59.9)).toBe('00:59')
  })

  it('survives what an element reports before it has metadata', () => {
    expect(formatClock(Number.NaN)).toBe('00:00')
    expect(formatClock(-3)).toBe('00:00')
  })
})
