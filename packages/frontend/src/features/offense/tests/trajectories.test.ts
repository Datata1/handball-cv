import { plays } from '../stories/offense'
import { playTrajectories } from '../trajectories'

/** `[t, x, y]`, the way the detector downsamples a segment. */
const line = [
  [10, 5, 5],
  [11, 6, 6],
]

describe('playTrajectories', () => {
  it('reads the tracks and the attacked end out of the detector’s details', () => {
    const drawn = playTrajectories(plays[0].details)

    expect(drawn?.goal).toBe('left')
    expect(drawn?.tracks.map((track) => track.trackId)).toEqual([3, 7])
    expect(drawn?.tracks[0].points[0]).toEqual({ x: 14.2, y: 6.8 })
    expect(drawn?.tracks[0].from).toBe(118)
    expect(drawn?.tracks[0].to).toBe(131)
  })

  it('marks the team centroid, which is a mean and not a player', () => {
    const drawn = playTrajectories(plays[3].details)

    expect(drawn?.goal).toBe('right')
    expect(drawn?.tracks.map((track) => track.centroid)).toEqual([true])
  })

  it('has nothing to draw for an event with no details', () => {
    expect(playTrajectories(null)).toBeNull()
  })

  // `details` is `dict[str, Any]` server-side, so the shape is a convention the
  // detector may break — the scene keeps its row either way.
  it('has nothing to draw for points that are not [t, x, y]', () => {
    expect(playTrajectories(plays[2].details)).toBeNull()
  })

  it('has nothing to draw when the detector stored no tracks', () => {
    expect(playTrajectories({ goal_x: 0, variante: 'positionswechsel' })).toBeNull()
    expect(playTrajectories({ tracks: [] })).toBeNull()
    expect(playTrajectories({ tracks: 'nope' })).toBeNull()
  })

  it('drops only the track it cannot draw', () => {
    const drawn = playTrajectories({
      goal_x: 0,
      tracks: [
        { track_id: 1, points: [[10, 5]] },
        { track_id: 2, points: line },
        { track_id: 3, points: [[10, 5, 5]] },
      ],
    })

    expect(drawn?.tracks.map((track) => track.trackId)).toEqual([2])
  })

  it('draws the tracks even when the attacked goal was not recorded', () => {
    const drawn = playTrajectories({ tracks: [{ track_id: 2, points: line }] })

    expect(drawn?.goal).toBeNull()
    expect(drawn?.tracks).toHaveLength(1)
  })

  it('places the goal by which half of the court it is in', () => {
    const tracks = [{ track_id: 2, points: line }]

    expect(playTrajectories({ goal_x: 0, tracks })?.goal).toBe('left')
    expect(playTrajectories({ goal_x: 40, tracks })?.goal).toBe('right')
    expect(playTrajectories({ goal_x: Number.NaN, tracks })?.goal).toBeNull()
  })
})
