import { heatmapSearch } from '@/features/report/search'
import { phaseItemId, playItemId } from '@/features/report/timeline'

import { heatmapFilters, isFiltered, phaseFromSelection } from '../filters'

const search = (overrides: Record<string, unknown> = {}) =>
  heatmapSearch.parse(overrides)

describe('heatmapFilters', () => {
  it('sends nothing at all for an untouched URL', () => {
    expect(heatmapFilters(search())).toEqual({
      phaseId: undefined,
      trackIds: undefined,
      perspective: undefined,
      windowStartS: undefined,
      windowEndS: undefined,
    })
  })

  // `both` is the backend's own no-op; sending it would only make a second
  // cache entry for the same answer.
  it('leaves the default perspective off the request', () => {
    expect(heatmapFilters(search({ perspective: 'both' })).perspective).toBeUndefined()
    expect(heatmapFilters(search({ perspective: 'defense' })).perspective).toBe(
      'defense',
    )
  })

  it('passes the track ids through as numbers', () => {
    expect(heatmapFilters(search({ tracks: [3, 7] })).trackIds).toEqual([3, 7])
  })

  it('sends the window only when both bounds are there', () => {
    const both = heatmapFilters(search({ from: 120, to: 300 }))

    expect(both.windowStartS).toBe(120)
    expect(both.windowEndS).toBe(300)
  })
})

describe('isFiltered', () => {
  it('is false for the whole match', () => {
    expect(isFiltered(search())).toBe(false)
  })

  it.each([
    ['a phase', { phase: 4 }],
    ['a perspective', { perspective: 'offense' }],
    ['a track', { tracks: [3] }],
    ['a window', { from: 10, to: 20 }],
  ])('is true once %s narrows it', (_case, narrowing) => {
    expect(isFiltered(search(narrowing))).toBe(true)
  })
})

describe('phaseFromSelection', () => {
  it('filters on the phase that was picked on the timeline', () => {
    expect(phaseFromSelection(null, phaseItemId(4), undefined)).toBe(4)
  })

  it('drops the filter when the active phase is deselected', () => {
    expect(phaseFromSelection(phaseItemId(4), null, 4)).toBeUndefined()
  })

  // The timeline carries goals, plays and formations too. Pointing the report at
  // one of those says nothing about which phase the heatmap is showing.
  it('leaves the filter alone when something else is picked', () => {
    expect(phaseFromSelection(phaseItemId(4), playItemId(11), 4)).toBe(4)
    expect(phaseFromSelection(playItemId(11), null, 4)).toBe(4)
  })

  // The store still holds the old selection for a render after the URL moved.
  // Reading that as a fresh pick would push the entry back forward.
  it('does not restore a phase the back button just left', () => {
    expect(phaseFromSelection(phaseItemId(4), null, undefined)).toBeUndefined()
  })
})
