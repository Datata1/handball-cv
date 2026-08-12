import { UNASSIGNED } from '@/features/report/teams'
import { availableTracks } from '../stories/heatmap'
import { asTrackParam, toggleBucket, toggleTrack, trackBuckets } from '../tracks'

describe('trackBuckets', () => {
  // `available_track_ids[].team` is the raw column, in the same response whose
  // points are normalised to A/B/U.
  it('buckets the raw team column, unassigned last', () => {
    expect(trackBuckets(availableTracks).map((bucket) => bucket.team)).toEqual([
      'A',
      'B',
      UNASSIGNED,
    ])
  })

  it('counts how much of each bucket the selection holds', () => {
    const [teamA, teamB] = trackBuckets(availableTracks, [3, 5, 7])

    expect(teamA.selected).toBe(2)
    expect(teamA.tracks).toHaveLength(3)
    expect(teamB.selected).toBe(1)
  })

  it('keeps a team id nobody knows as its own bucket', () => {
    const buckets = trackBuckets([
      ...availableTracks,
      { ...availableTracks[0], track_id: 99, team: 'C' },
    ])

    expect(buckets.map((bucket) => bucket.team)).toContain('C')
  })
})

describe('toggleTrack', () => {
  it('adds a track and removes it again', () => {
    expect(toggleTrack([], 7)).toEqual([7])
    expect(toggleTrack([3, 7], 7)).toEqual([3])
  })

  // The list is a query key and a URL: `[7,3]` and `[3,7]` are one filter, and
  // an insertion-ordered list would cache and link as two.
  it('keeps the selection in ascending order', () => {
    expect(toggleTrack([7, 11], 3)).toEqual([3, 7, 11])
  })
})

describe('toggleBucket', () => {
  it('adds every track of a partly selected bucket', () => {
    const [teamA] = trackBuckets(availableTracks, [3])

    expect(toggleBucket([3], teamA)).toEqual([3, 5, 9])
  })

  it('removes the bucket once it is complete, leaving the rest alone', () => {
    const [teamA] = trackBuckets(availableTracks, [3, 5, 9, 7])

    expect(toggleBucket([3, 5, 9, 7], teamA)).toEqual([7])
  })
})

describe('asTrackParam', () => {
  // An empty `track_ids` is no filter to this backend, so an empty array in the
  // URL would claim a filter the server ignores.
  it('drops an empty selection rather than putting it in the URL', () => {
    expect(asTrackParam([])).toBeUndefined()
    expect(asTrackParam([3])).toEqual([3])
  })
})
