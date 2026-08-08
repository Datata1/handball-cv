import { QueryClient } from '@tanstack/react-query'

import { qk } from '../keys'

function seeded() {
  const queryClient = new QueryClient()

  queryClient.setQueryData(qk.matches(), [])
  queryClient.setQueryData(qk.stats('m1'), { match_id: 'm1' })
  queryClient.setQueryData(qk.plays('m1', { playType: 'Kreuzen' }), [])
  queryClient.setQueryData(qk.plays('m1', { playType: 'Parallelstoß' }), [])
  queryClient.setQueryData(qk.stats('m2'), { match_id: 'm2' })

  return queryClient
}

function invalidated(queryClient: QueryClient, key: readonly unknown[]) {
  return queryClient.getQueryState(key)?.isInvalidated ?? false
}

describe('qk', () => {
  it('drops one match’s whole subtree in a single call', () => {
    const queryClient = seeded()

    void queryClient.invalidateQueries({ queryKey: qk.match('m1') })

    expect(invalidated(queryClient, qk.stats('m1'))).toBe(true)
    expect(invalidated(queryClient, qk.plays('m1', { playType: 'Kreuzen' }))).toBe(true)
    expect(invalidated(queryClient, qk.stats('m2'))).toBe(false)
  })

  // The obvious key shape — ['matches'] for the list, ['matches', id] for one
  // match — makes this fail: the list would be a prefix of every match subtree,
  // and the SSE bridge invalidates the list on every single status event.
  it('does not touch any match when only the list is invalidated', () => {
    const queryClient = seeded()

    void queryClient.invalidateQueries({ queryKey: qk.matches() })

    expect(invalidated(queryClient, qk.matches())).toBe(true)
    expect(invalidated(queryClient, qk.stats('m1'))).toBe(false)
    expect(invalidated(queryClient, qk.stats('m2'))).toBe(false)
  })

  it('sweeps the list and every match under qk.all()', () => {
    const queryClient = seeded()

    void queryClient.invalidateQueries({ queryKey: qk.all() })

    expect(invalidated(queryClient, qk.matches())).toBe(true)
    expect(invalidated(queryClient, qk.stats('m1'))).toBe(true)
    expect(invalidated(queryClient, qk.stats('m2'))).toBe(true)
  })

  it('caches each filter combination separately', () => {
    const queryClient = seeded()

    void queryClient.invalidateQueries({
      queryKey: qk.plays('m1', { playType: 'Kreuzen' }),
    })

    expect(invalidated(queryClient, qk.plays('m1', { playType: 'Kreuzen' }))).toBe(true)
    expect(invalidated(queryClient, qk.plays('m1', { playType: 'Parallelstoß' }))).toBe(
      false,
    )
  })

  // Filters arrive from URL search params, where property order is whatever the
  // route builder happened to produce.
  it('hashes a filter object independently of property order', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(
      qk.heatmap('m1', { phaseId: 3, perspective: 'offense' }),
      [],
    )

    expect(
      queryClient.getQueryData(
        qk.heatmap('m1', { perspective: 'offense', phaseId: 3 }),
      ),
    ).toEqual([])
  })
})
