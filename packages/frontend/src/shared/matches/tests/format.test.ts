import { formatMatchDate } from '../format'

describe('formatMatchDate', () => {
  it('formats an ISO timestamp for the locale', () => {
    expect(formatMatchDate('2026-08-07T23:32:40.153507', 'de')).toBe('07.08.2026')
  })

  it('returns null for an absent or unparseable date', () => {
    expect(formatMatchDate(null)).toBeNull()
    expect(formatMatchDate('nicht gesetzt')).toBeNull()
  })
})
