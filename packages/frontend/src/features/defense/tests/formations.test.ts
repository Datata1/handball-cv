import {
  formationRows,
  formationTable,
  hasFormations,
  NON_FORMATION_LABELS,
  sceneDuration,
  scenesFor,
} from '../formations'
import {
  novelFormationSummary,
  phaseOnlySummary,
  scenes,
  summary,
} from '../stories/defense'

describe('formationRows', () => {
  it('drops the phase labels the classifier writes into the same column', () => {
    const rows = formationRows(summary[0])

    expect(rows.map((row) => row.formation)).toEqual(['6-0', '5-1', '3-2-1'])
    for (const excluded of NON_FORMATION_LABELS) {
      expect(rows.some((row) => row.formation === excluded)).toBe(false)
    }
  })

  it('orders by count and shares out the frames that are left', () => {
    const rows = formationRows(summary[0])

    expect(rows.map((row) => row.count)).toEqual([18_000, 7_200, 2_400])
    expect(rows.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 10)
    expect(rows[0].share).toBeCloseTo(18_000 / 27_600, 10)
  })

  // `dominant` from the response is picked over every label, so it is usually
  // "attack" — a phase, and not a defensive shape at all.
  it('marks the most-used shape rather than the response’s own dominant', () => {
    const rows = formationRows(summary[0])

    expect(summary[0].dominant).toBe('attack')
    expect(rows.filter((row) => row.dominant).map((row) => row.formation)).toEqual([
      '6-0',
    ])
  })

  it('keeps a label no dictionary knows', () => {
    const rows = formationRows(novelFormationSummary[0])

    expect(rows.map((row) => row.formation)).toEqual(['gcn-cluster-7', '4-2-flex'])
  })

  it('leaves nothing behind for a team that was only ever in a phase', () => {
    expect(formationRows(phaseOnlySummary[0])).toEqual([])
  })

  it('orders equal counts the same way every time', () => {
    const tied = { team: 'A', formations: { b: 10, a: 10, c: 10 }, dominant: 'b' }

    expect(formationRows(tied).map((row) => row.formation)).toEqual(['a', 'b', 'c'])
  })
})

describe('formationTable', () => {
  it('covers every team the summary carried, in a stable order', () => {
    const teams = formationTable([...summary].reverse())

    expect(teams.map((team) => team.team)).toEqual(['A', 'B'])
    expect(teams[0].total).toBe(27_600)
  })

  it('knows when no team stood in anything', () => {
    expect(hasFormations(formationTable(summary))).toBe(true)
    expect(hasFormations(formationTable(phaseOnlySummary))).toBe(false)
    expect(hasFormations(formationTable([]))).toBe(false)
  })
})

describe('scenesFor', () => {
  it('narrows to one team’s runs of one formation, oldest first', () => {
    const picked = scenesFor(scenes, { team: 'A', formation: '6-0' })

    expect(picked.map((scene) => scene.scene_id)).toEqual([4, 5])
  })

  it('treats a missing half of the filter as no filter', () => {
    expect(scenesFor(scenes, { formation: '5-1' }).map((scene) => scene.team)).toEqual([
      'A',
      'B',
    ])
    expect(scenesFor(scenes, {})).toHaveLength(scenes.length)
  })

  it('measures a scene from its own timestamps', () => {
    expect(sceneDuration(scenes[0])).toBe(150)
  })
})
