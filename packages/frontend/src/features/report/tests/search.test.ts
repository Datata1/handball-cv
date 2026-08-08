import { defenseSearch, heatmapSearch, offenseSearch, reportSearch } from '../search'

describe('reportSearch', () => {
  it('carries the playhead', () => {
    expect(reportSearch.parse({ at: 754.2 })).toEqual({ at: 754.2 })
  })

  it('drops a playhead that is not a time', () => {
    expect(reportSearch.parse({ at: 'gestern' })).toEqual({ at: undefined })
    expect(reportSearch.parse({ at: -1 })).toEqual({ at: undefined })
  })
})

describe('defenseSearch', () => {
  it('accepts whatever label the backend uses, without an allowlist', () => {
    expect(defenseSearch.parse({ team: 'A', formation: '5-1 offensiv' })).toEqual({
      team: 'A',
      formation: '5-1 offensiv',
    })
  })

  it('reads an empty param as no filter', () => {
    expect(defenseSearch.parse({ team: '', formation: '  ' })).toEqual({
      team: undefined,
      formation: undefined,
    })
  })
})

describe('offenseSearch', () => {
  it('keeps the play type as an open string', () => {
    expect(offenseSearch.parse({ playType: 'Kreuzen' })).toEqual({
      playType: 'Kreuzen',
    })
  })
})

describe('heatmapSearch', () => {
  it('defaults the two view modes so an empty URL is a valid one', () => {
    expect(heatmapSearch.parse({})).toEqual({
      mode: 'density',
      perspective: 'both',
      phase: undefined,
      tracks: undefined,
      from: undefined,
      to: undefined,
    })
  })

  it('restores a fully specified deep link', () => {
    expect(
      heatmapSearch.parse({
        mode: 'tiles',
        perspective: 'offense',
        phase: 12,
        tracks: [3, 7],
        from: 120,
        to: 300,
      }),
    ).toEqual({
      mode: 'tiles',
      perspective: 'offense',
      phase: 12,
      tracks: [3, 7],
      from: 120,
      to: 300,
    })
  })

  it.each([
    ['mode', { mode: 'schummer' }, { mode: 'density' }],
    ['perspective', { perspective: 'links' }, { perspective: 'both' }],
    ['phase', { phase: 'zwei' }, { phase: undefined }],
    ['tracks', { tracks: 'alle' }, { tracks: undefined }],
  ])('falls back to the default for an unparseable %s', (_case, input, expected) => {
    expect(heatmapSearch.parse(input)).toMatchObject(expected)
  })

  it('rejects a half-specified time window rather than widening it', () => {
    expect(heatmapSearch.safeParse({ from: 120 }).success).toBe(false)
    expect(heatmapSearch.safeParse({ to: 300 }).success).toBe(false)
  })

  it('accepts no window at all', () => {
    expect(heatmapSearch.safeParse({}).success).toBe(true)
  })
})
