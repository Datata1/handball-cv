import { formations, goals, phases, plays } from '../stories/report'
import { buildTimelineTracks, type TimelineLabels } from '../timeline'

const labels: TimelineLabels = {
  tracks: {
    goals: 'Tore',
    phases: 'Ballbesitz',
    plays: 'Spielzüge',
    formations: 'Formationen',
  },
  goal: (goal) => `Tor ${goal.team}, ${goal.score_home}:${goal.score_away}`,
  phase: (phase) => `Angriff ${phase.offense_team}`,
  play: (play) => `${play.play_type}, ${play.team}`,
  formation: (scene) => `${scene.formation}, ${scene.team}`,
}

describe('buildTimelineTracks', () => {
  it('lays the four sources out in reading order', () => {
    const tracks = buildTimelineTracks({ goals, phases, plays, formations }, labels)

    expect(tracks.map((track) => track.id)).toEqual([
      'goals',
      'phases',
      'plays',
      'formations',
    ])
  })

  // A lane with no bars in it says "the detector looked and found nothing".
  // A source that never answered has not looked.
  it('leaves out a source that has not loaded', () => {
    const tracks = buildTimelineTracks({ phases }, labels)

    expect(tracks.map((track) => track.id)).toEqual(['phases'])
  })

  it('keeps an empty track that did answer', () => {
    const tracks = buildTimelineTracks({ plays: [] }, labels)

    expect(tracks).toHaveLength(1)
    expect(tracks[0]?.items).toEqual([])
  })

  it('places goals as markers on the second they were read', () => {
    const [track] = buildTimelineTracks({ goals }, labels)

    expect(track?.kind).toBe('marker')
    expect(track?.items[0]).toMatchObject({
      id: 'goal-3450',
      start: 138,
      label: 'Tor home, 1:0',
      tone: 'event',
    })
  })

  it('gives every item an id unique across the whole timeline', () => {
    const tracks = buildTimelineTracks({ goals, phases, plays, formations }, labels)
    const ids = tracks.flatMap((track) => track.items.map((item) => item.id))

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('tones a bar by the team it belongs to, and only by a known one', () => {
    const [track] = buildTimelineTracks({ phases }, labels)

    expect(track?.items.map((item) => item.tone)).toEqual(['teamA', 'teamB', 'teamA'])
  })

  it('carries a formation label a dictionary has never seen', () => {
    const [track] = buildTimelineTracks({ formations }, labels)

    expect(track?.items.at(-1)).toMatchObject({ short: '3-2-1', label: '3-2-1, B' })
  })
})
