import { playDuration, playOutcome, playsFor, playTypeTable } from '../plays'
import { plays, summary, unratedSummary } from '../stories/offense'

describe('playTypeTable', () => {
  it('folds the per-team rows back into one row per play type', () => {
    const rows = playTypeTable(summary)

    expect(rows.map((row) => row.playType)).toEqual([
      'kreuzen',
      'tempogegenstoss',
      'einlaeufer',
      'rueckraumdurchbruch',
    ])
    expect(rows[0].total).toBe(20)
    expect(rows[0].teams).toEqual([
      { team: 'A', count: 14 },
      { team: 'B', count: 6 },
    ])
  })

  it('shares each type out over every play that was detected', () => {
    const rows = playTypeTable(summary)

    expect(rows[0].share).toBeCloseTo(20 / 42, 10)
    expect(rows.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 10)
  })

  // The GCN + LSTM work changes the label set, and the legacy section iterated a
  // dictionary of four — so a fifth type was invisible.
  it('keeps a play type no dictionary knows', () => {
    const rows = playTypeTable(summary)

    expect(rows.some((row) => row.playType === 'rueckraumdurchbruch')).toBe(true)
  })

  it('rates a type over both teams’ attacks together', () => {
    const [kreuzen] = playTypeTable(summary)

    expect(kreuzen.attacksRated).toBe(12)
    expect(kreuzen.attacksGoal).toBe(6)
    expect(kreuzen.successRate).toBeCloseTo(0.5, 10)
  })

  // `0` would read as "never scored", which is a measurement nobody made.
  it('has no success rate at all when no attack was rated', () => {
    expect(playTypeTable(summary)[2].successRate).toBeNull()
    for (const row of playTypeTable(unratedSummary)) {
      expect(row.successRate).toBeNull()
    }
  })

  it('weights the confidences by how many events each covers', () => {
    const [kreuzen] = playTypeTable(summary)

    expect(kreuzen.avgConfidence).toBeCloseTo((0.81 * 14 + 0.66 * 6) / 20, 10)
  })

  it('orders equal counts the same way every time', () => {
    const tied = [
      { play_type: 'b', team: 'A', count: 3 },
      { play_type: 'a', team: 'A', count: 3 },
      { play_type: 'c', team: 'A', count: 3 },
    ].map((row) => ({
      ...row,
      avg_confidence: 0.5,
      attacks_rated: 0,
      attacks_goal: 0,
      success_rate: null,
    }))

    expect(playTypeTable(tied).map((row) => row.playType)).toEqual(['a', 'b', 'c'])
  })

  it('survives a match with nothing detected', () => {
    expect(playTypeTable([])).toEqual([])
  })
})

describe('playsFor', () => {
  it('narrows to one play type, oldest first', () => {
    const picked = playsFor(plays, { playType: 'kreuzen' })

    expect(picked.map((play) => play.event_id)).toEqual([11, 12, 13])
  })

  it('treats a missing filter as no filter', () => {
    expect(playsFor(plays, {})).toHaveLength(plays.length)
  })

  it('measures a scene from its own timestamps', () => {
    expect(playDuration(plays[0])).toBe(13)
  })
})

describe('playOutcome', () => {
  it('reads a settled attack', () => {
    expect(playOutcome(plays[0])).toBe('goal')
    expect(playOutcome(plays[1])).toBe('no_goal')
  })

  // "No attack linked" and "this database predates attack sequences" are one
  // and the same value, and neither of them is "kein Tor".
  it('reads no attack at all as unknown', () => {
    expect(playOutcome(plays[2])).toBeNull()
    expect(playOutcome({ ...plays[0], outcome: '  ' })).toBeNull()
  })
})
