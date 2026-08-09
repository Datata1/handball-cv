import { match, unnamedMatch } from '../stories/report'
import { teamNamer } from '../teams'

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
