import { match, unnamedMatch } from '../stories/report'
import { teamBucket, teamBuckets, teamNamer, UNASSIGNED } from '../teams'

const fallback = (team: string) => `Team ${team}`

describe('teamNamer', () => {
  it('uses the name the trainer set', () => {
    const name = teamNamer(match, fallback)

    expect(name('A')).toBe('HSG Nord')
    expect(name('B')).toBe('TV Süd')
  })

  it('falls back where nothing was set', () => {
    const name = teamNamer(unnamedMatch, fallback)

    expect(name('A')).toBe('Team A')
  })

  it('falls back for a whitespace name, which is not a name', () => {
    expect(teamNamer({ ...match, team_a_name: '  ' }, fallback)('A')).toBe('Team A')
  })

  // The classifier's own values reach this: `unknown` today, whatever the GCN
  // emits later.
  it('passes an unrecognised team to the label lookup', () => {
    expect(teamNamer(match, fallback)('unknown')).toBe('Team unknown')
  })
})

describe('teamBucket', () => {
  it('keeps a team the classifier assigned', () => {
    expect(teamBucket('A')).toBe('A')
    expect(teamBucket('b')).toBe('B')
  })

  // `player_stats.team` is `ANY_VALUE(team)` and `available_track_ids[].team` is
  // the raw column, so both reach the client and mean the same thing.
  it('reads a null and the classifier’s "unknown" as the same bucket', () => {
    expect(teamBucket(null)).toBe(UNASSIGNED)
    expect(teamBucket('unknown')).toBe(UNASSIGNED)
    expect(teamBucket('  ')).toBe(UNASSIGNED)
  })

  it('leaves a team id nobody knows as itself', () => {
    expect(teamBucket('C')).toBe('C')
  })
})

describe('teamBuckets', () => {
  it('lists each bucket once, with the unassigned one last', () => {
    expect(teamBuckets([null, 'B', 'A', 'unknown', 'B'])).toEqual([
      'A',
      'B',
      UNASSIGNED,
    ])
  })

  it('is empty when there is nothing to bucket', () => {
    expect(teamBuckets([])).toEqual([])
  })
})
