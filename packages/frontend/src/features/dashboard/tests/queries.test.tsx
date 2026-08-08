import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import type { MatchMeta } from '@/shared/api'
import { createQueryClient, qk } from '@/shared/query'
import { stubApi } from '@/testing/api'

import { useMatchMutations } from '../queries'
import { done, processing, unnamed } from '../stories/matches'

/**
 * The two mutations against a stubbed backend. What the cache holds mid-flight
 * and after a failure is the whole point of them, so these assert on the cache
 * rather than on a rendered card.
 */
function mountMutations(list: MatchMeta[] = [done, unnamed]) {
  const queryClient = createQueryClient()
  queryClient.setQueryData(qk.matches(), list)

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return { queryClient, ...renderHook(() => useMatchMutations(), { wrapper }) }
}

/** A backend that has received the request and not answered yet. */
function pendingApi(): () => void {
  let answer: (() => void) | undefined

  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          answer = () =>
            resolve(
              new Response(JSON.stringify({ ok: true, deleted: 'seed01' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
        }),
    ),
  )

  return () => answer?.()
}

function listedMatch(queryClient: ReturnType<typeof createQueryClient>, id: string) {
  return queryClient
    .getQueryData<MatchMeta[]>(qk.matches())
    ?.find((match) => match.match_id === id)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useMatchMutations', () => {
  it('shows a rename while the server is still thinking about it', async () => {
    const answer = pendingApi()
    const { queryClient, result } = mountMutations()

    await act(async () => {
      result.current.rename('seed01', 'team_a_name', 'SC Magdeburg')
    })

    await waitFor(() =>
      expect(result.current.saving).toEqual({
        matchId: 'seed01',
        field: 'team_a_name',
      }),
    )
    expect(listedMatch(queryClient, 'seed01')?.team_a_name).toBe('SC Magdeburg')

    await act(async () => {
      answer()
    })
    await waitFor(() => expect(result.current.saving).toBeNull())
    expect(result.current.renameFailed).toBeNull()
  })

  it('patches only the field that changed, since an empty body is a 400', async () => {
    stubApi({ '/matches/seed01': { ok: true } })
    const { result } = mountMutations()

    await act(async () => {
      result.current.rename('seed01', 'display_name', 'Pokalspiel')
    })
    await waitFor(() => expect(result.current.saving).toBeNull())

    const [, init] = vi.mocked(fetch).mock.calls.at(-1) ?? []
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({ display_name: 'Pokalspiel' })
  })

  it('rolls a failed rename back to what the server still has', async () => {
    stubApi({})
    const { queryClient, result } = mountMutations()

    await act(async () => {
      result.current.rename('seed01', 'team_a_name', 'SC Magdeburg')
    })
    await waitFor(() => expect(result.current.renameFailed).not.toBeNull())

    expect(listedMatch(queryClient, 'seed01')?.team_a_name).toBe('HSG Nord')
    expect(result.current.renameFailed).toEqual({
      matchId: 'seed01',
      field: 'team_a_name',
    })
  })

  it('takes the card out of the list before the delete has answered', async () => {
    const answer = pendingApi()
    const { queryClient, result } = mountMutations()

    await act(async () => {
      result.current.remove('seed01')
    })

    expect(listedMatch(queryClient, 'seed01')).toBeUndefined()

    await act(async () => {
      answer()
    })
    await waitFor(() => expect(result.current.deleteFailed).toBeNull())
  })

  it('drops everything cached under a deleted match', async () => {
    stubApi({ '/matches/seed01': { ok: true, deleted: 'seed01' } })
    const { queryClient, result } = mountMutations()
    queryClient.setQueryData(qk.stats('seed01'), { match_id: 'seed01' })

    await act(async () => {
      result.current.remove('seed01')
    })

    await waitFor(() =>
      expect(queryClient.getQueryData(qk.stats('seed01'))).toBeUndefined(),
    )
  })

  // The row lookup DELETE answers goes through the same frozen read as
  // everything else, so a 404 is not proof the match is gone.
  it('puts the card back when the delete 404s, and blames the ingestion', async () => {
    stubApi({})
    const { queryClient, result } = mountMutations([done, processing])

    await act(async () => {
      result.current.remove('seed01')
    })
    await waitFor(() => expect(result.current.deleteFailed).not.toBeNull())

    expect(listedMatch(queryClient, 'seed01')).toBeDefined()
    expect(result.current.deleteFailed).toEqual({ matchId: 'seed01', blocked: true })
  })

  it('does not blame an ingestion that is not running', async () => {
    stubApi({})
    const { queryClient, result } = mountMutations()

    await act(async () => {
      result.current.remove('seed01')
    })
    await waitFor(() => expect(result.current.deleteFailed).not.toBeNull())

    expect(listedMatch(queryClient, 'seed01')).toBeDefined()
    expect(result.current.deleteFailed).toEqual({ matchId: 'seed01', blocked: false })
  })
})
