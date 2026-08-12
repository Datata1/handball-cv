import { statusChanges, statusesById } from '../announce'
import { done, failed, processing, unnamed } from '../stories/matches'

describe('statusChanges', () => {
  it('reports a status that moved', () => {
    const previous = statusesById([{ ...done, status: 'processing' }])

    expect(statusChanges(previous, [done])).toEqual([
      { matchId: 'seed01', title: 'Testspiel Nord vs Süd', status: 'done' },
    ])
  })

  it('reports a match the previous list did not have', () => {
    expect(statusChanges(statusesById([done]), [done, failed])).toHaveLength(1)
  })

  it('reports nothing for a list that only changed identity', () => {
    expect(statusChanges(statusesById([done, processing]), [done, processing])).toEqual(
      [],
    )
  })

  // The badge says "Unbekannt" and the card is still there; there is nothing to
  // interrupt a reader for.
  it('says nothing about a status file the backend could not read', () => {
    expect(
      statusChanges(statusesById([done]), [{ ...unnamed, status: 'unknown' }]),
    ).toEqual([])
  })

  // The user pressed delete, and the button they pressed already said so.
  it('says nothing about a match that disappeared', () => {
    expect(statusChanges(statusesById([done, failed]), [done])).toEqual([])
  })

  it('falls back to the file name for a match nobody named', () => {
    const previous = statusesById([{ ...unnamed, status: 'processing' }])

    expect(statusChanges(previous, [unnamed])[0].title).toBe(
      'aufzeichnung-2026-05-02.mp4',
    )
  })
})
