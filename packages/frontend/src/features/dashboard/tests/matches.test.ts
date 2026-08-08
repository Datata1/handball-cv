import type { MatchMeta } from '@/shared/api'

import {
  filterMatches,
  formatDate,
  matchTitle,
  parseDuration,
  sortMatches,
  summariseMatches,
} from '../matches'
import { done, failed, longNames, mixed, processing, unnamed } from '../stories/matches'

describe('matchTitle', () => {
  it('prefers the name a trainer gave the match', () => {
    expect(matchTitle(done)).toBe('Testspiel Nord vs Süd')
  })

  it('falls back to the file name, then to the id', () => {
    expect(matchTitle(unnamed)).toBe('aufzeichnung-2026-05-02.mp4')
    expect(matchTitle(processing)).toBe('pending9')
  })

  it('ignores a display name that is only whitespace', () => {
    expect(matchTitle({ ...done, display_name: '   ' })).toBe('seed01.mp4')
  })
})

describe('filterMatches', () => {
  it('returns everything when nothing is searched for', () => {
    expect(filterMatches(mixed, undefined)).toHaveLength(mixed.length)
    expect(filterMatches(mixed, '  ')).toHaveLength(mixed.length)
  })

  it('matches a team name regardless of case', () => {
    expect(filterMatches(mixed, 'hsg nord').map(matchTitle)).toEqual([
      'Testspiel Nord vs Süd',
    ])
  })

  it('matches the file name of a match nobody has renamed', () => {
    expect(filterMatches(mixed, 'aufzeichnung')).toEqual([unnamed])
  })

  it('drops the stub rows, whose every searchable field is null', () => {
    expect(filterMatches(mixed, 'nord')).not.toContain(processing)
  })
})

describe('sortMatches', () => {
  it('puts the newest analysis first', () => {
    expect(sortMatches([unnamed, done], 'recent')).toEqual([done, unnamed])
  })

  it('puts a match that has not finished ingesting above the finished ones', () => {
    expect(sortMatches([done, processing], 'recent')[0]).toBe(processing)
  })

  it('orders by the visible title, not by the id', () => {
    expect(
      sortMatches([done, longNames, unnamed], 'name', 'de').map(matchTitle),
    ).toEqual([
      'aufzeichnung-2026-05-02.mp4',
      'Landesliga Nord — 14. Spieltag, Nachholspiel im Sportpark Ost',
      'Testspiel Nord vs Süd',
    ])
  })

  it('leaves its input alone', () => {
    const input: MatchMeta[] = [unnamed, done]
    sortMatches(input, 'recent')

    expect(input).toEqual([unnamed, done])
  })
})

describe('parseDuration', () => {
  it('reads the MM:SS the backend sends', () => {
    expect(parseDuration('01:00')).toBe(60)
  })

  it('reads minutes past the hour, which are not wrapped', () => {
    expect(parseDuration('72:15')).toBe(4335)
  })

  it('returns null for a stub row rather than zero', () => {
    expect(parseDuration(null)).toBeNull()
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('unbekannt')).toBeNull()
  })
})

describe('summariseMatches', () => {
  it('counts every match, including the ones still ingesting', () => {
    expect(summariseMatches(mixed).total).toBe(4)
  })

  it('adds up the durations it knows and reports the newest ingest', () => {
    const summary = summariseMatches([done, unnamed, processing])

    expect(summary.videoMinutes).toBe(73)
    expect(summary.lastAnalysis).toBe(done.ingested_at)
  })

  it('says "not measured" rather than zero when nothing has a duration', () => {
    expect(summariseMatches([processing, failed])).toEqual({
      total: 2,
      videoMinutes: null,
      lastAnalysis: null,
    })
  })
})

describe('formatDate', () => {
  it('formats an ISO timestamp for the locale', () => {
    expect(formatDate('2026-08-07T23:32:40.153507', 'de')).toBe('07.08.2026')
  })

  it('returns null for an absent or unparseable date', () => {
    expect(formatDate(null)).toBeNull()
    expect(formatDate('nicht gesetzt')).toBeNull()
  })
})
