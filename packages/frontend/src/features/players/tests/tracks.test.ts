import { UNASSIGNED } from '@/features/report/teams'
import type { PlayerStat } from '@/shared/api'

import {
  DEFAULT_TRACK_SORT,
  filterTracks,
  isTrackSortKey,
  nextSort,
  sortTracks,
} from '../tracks'

function track(id: number, team: string | null, frames = 100): PlayerStat {
  return {
    track_id: id,
    team,
    frame_count: frames,
    avg_confidence_pct: 80,
    distance_m: 1_000,
  }
}

describe('filterTracks', () => {
  const tracks = [track(1, 'A'), track(2, 'B'), track(3, null), track(4, 'unknown')]

  it('keeps everything when no team is picked', () => {
    expect(filterTracks(tracks, undefined)).toHaveLength(4)
  })

  it('narrows to one team', () => {
    expect(filterTracks(tracks, 'A').map((row) => row.track_id)).toEqual([1])
  })

  it('collects both spellings of "no team" in one bucket', () => {
    expect(filterTracks(tracks, UNASSIGNED).map((row) => row.track_id)).toEqual([3, 4])
  })

  it('answers a bucket no row carries with no rows', () => {
    expect(filterTracks(tracks, 'C')).toEqual([])
  })
})

describe('sortTracks', () => {
  const tracks = [
    track(9, 'B', 300),
    track(2, 'A', 500),
    track(5, null, 100),
    track(7, 'A', 300),
  ]

  it('orders by the longest-lived track by default', () => {
    expect(sortTracks(tracks, DEFAULT_TRACK_SORT).map((row) => row.track_id)).toEqual([
      2, 7, 9, 5,
    ])
  })

  // Two tracks on 300 frames: whichever direction the column is in, the tie is
  // broken the same way, so a re-render cannot reshuffle equal rows.
  it('breaks a tie on the track id in both directions', () => {
    const descending = sortTracks(tracks, { key: 'frames', direction: 'descending' })
    const ascending = sortTracks(tracks, { key: 'frames', direction: 'ascending' })

    expect(descending.map((row) => row.track_id)).toEqual([2, 7, 9, 5])
    expect(ascending.map((row) => row.track_id)).toEqual([5, 7, 9, 2])
  })

  it('orders by the team bucket, unassigned included', () => {
    expect(
      sortTracks(tracks, { key: 'team', direction: 'ascending' }).map(
        (row) => row.track_id,
      ),
    ).toEqual([2, 7, 9, 5])
  })

  it('leaves the input alone', () => {
    const input = [...tracks]
    sortTracks(input, { key: 'track', direction: 'ascending' })

    expect(input.map((row) => row.track_id)).toEqual([9, 2, 5, 7])
  })
})

describe('nextSort', () => {
  it('flips the column that is already sorted', () => {
    expect(nextSort({ key: 'frames', direction: 'descending' }, 'frames')).toEqual({
      key: 'frames',
      direction: 'ascending',
    })
  })

  it('starts a figure at its biggest and an id at its first', () => {
    const from = DEFAULT_TRACK_SORT

    expect(nextSort(from, 'distance').direction).toBe('descending')
    expect(nextSort(from, 'track').direction).toBe('ascending')
    expect(nextSort(from, 'team').direction).toBe('ascending')
  })
})

describe('isTrackSortKey', () => {
  it('accepts a column id and rejects anything else', () => {
    expect(isTrackSortKey('distance')).toBe(true)
    expect(isTrackSortKey('tore')).toBe(false)
  })
})
