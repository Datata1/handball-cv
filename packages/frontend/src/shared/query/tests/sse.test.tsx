import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import { matchListSchema } from '@/shared/api'

import processingFixture from '../../api/tests/fixtures/matches-processing.json'
import { qk } from '../keys'
import { createStatusBridge, INVALIDATION_DEBOUNCE_MS, useStatusStream } from '../sse'

/**
 * Stands in for the browser's EventSource, which jsdom does not implement.
 *
 * Built on EventTarget so `addEventListener` behaves exactly as it does in the
 * browser — including the part that matters most here: a `: heartbeat` comment
 * never becomes an event at all, so there is nothing for the fake to emit.
 */
class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = []

  readyState = 0
  closed = false

  constructor(readonly url: string) {
    super()
    FakeEventSource.instances.push(this)
  }

  close() {
    this.closed = true
    this.readyState = 2
  }

  /** The server's generator ack, re-sent on every reconnect. */
  connect() {
    this.readyState = 1
    this.dispatchEvent(new MessageEvent('connected', { data: '{}' }))
  }

  status(data: unknown) {
    this.dispatchEvent(
      new MessageEvent('status', {
        data: typeof data === 'string' ? data : JSON.stringify(data),
      }),
    )
  }

  drop() {
    this.readyState = 0
    this.dispatchEvent(new Event('error'))
  }
}

function latestSource(): FakeEventSource {
  const source = FakeEventSource.instances.at(-1)
  if (!source) throw new Error('nothing opened an EventSource')
  return source
}

function mountStream(queryClient: QueryClient) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  const view = renderHook(() => useStatusStream(), { wrapper: Wrapper })
  return { view, source: latestSource() }
}

/** The query keys an `invalidateQueries` spy was called with, in order. */
function keysOf(invalidate: { mock: { calls: unknown[][] } }) {
  return invalidate.mock.calls.map(
    (call) => (call[0] as { queryKey: unknown }).queryKey,
  )
}

beforeEach(() => {
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('createStatusBridge', () => {
  function setup() {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const bridge = createStatusBridge(queryClient, 0)
    return { queryClient, invalidate, bridge }
  }

  it('scopes a done event to the list and that one match', () => {
    const { invalidate, bridge } = setup()

    bridge.handleEvent({ match_id: 'm1', status: 'done' })
    bridge.flush()

    expect(keysOf(invalidate)).toEqual([qk.matches(), qk.match('m1')])
  })

  // Nothing became readable — the match has no data yet, or never will.
  it('invalidates only the list for processing and failed', () => {
    const { invalidate, bridge } = setup()

    bridge.handleEvent({ match_id: 'm1', status: 'processing' })
    bridge.flush()
    bridge.handleEvent({ match_id: 'm2', status: 'failed' })
    bridge.flush()

    expect(keysOf(invalidate)).toEqual([qk.matches(), qk.matches()])
  })

  /**
   * While a match is processing, list endpoints answer `[]` — a successful
   * response that gets cached for its full staleTime. When the last ingest
   * finishes, everything cached during that window is suspect.
   */
  it('sweeps the whole cache when the last processing match finishes', () => {
    const { queryClient, invalidate, bridge } = setup()
    queryClient.setQueryData(qk.matches(), matchListSchema.parse(processingFixture))

    bridge.handleEvent({ match_id: 'pending9', status: 'done' })
    bridge.flush()

    expect(keysOf(invalidate)).toEqual([qk.all()])
  })

  it('does not sweep while another match is still processing', () => {
    const { invalidate, bridge } = setup()

    bridge.handleEvent({ match_id: 'a', status: 'processing' })
    bridge.handleEvent({ match_id: 'b', status: 'processing' })
    bridge.flush()
    invalidate.mockClear()

    bridge.handleEvent({ match_id: 'a', status: 'done' })
    bridge.flush()

    expect(keysOf(invalidate)).toEqual([qk.matches(), qk.match('a')])
  })

  it('refetches the list on reconnect, since the stream cannot resume', () => {
    const { invalidate, bridge } = setup()

    bridge.handleReconnect()
    bridge.flush()

    expect(keysOf(invalidate)).toEqual([qk.matches()])
  })

  it('sweeps on reconnect if an ingest was in flight when the stream dropped', () => {
    const { invalidate, bridge } = setup()

    bridge.handleEvent({ match_id: 'a', status: 'processing' })
    bridge.flush()
    invalidate.mockClear()

    bridge.handleReconnect()
    bridge.flush()

    expect(keysOf(invalidate)).toEqual([qk.all()])
  })

  it('ignores events after dispose', () => {
    const { invalidate, bridge } = setup()

    bridge.dispose()
    bridge.handleEvent({ match_id: 'm1', status: 'done' })
    bridge.flush()

    expect(invalidate).not.toHaveBeenCalled()
  })

  // GET /matches rewrites status files, each rewrite emits an event, and the
  // handler refetches GET /matches. Without a counter, a regression here is a
  // silent request storm.
  it('warns in dev once the rounds per minute stop looking like transitions', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { bridge } = setup()

    for (let i = 0; i < 21; i++) {
      bridge.handleEvent({ match_id: `m${i}`, status: 'failed' })
      bridge.flush()
    }

    expect(bridge.flushesInLastMinute()).toBe(21)
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('useStatusStream', () => {
  it('opens exactly one connection, to the backend stream', () => {
    mountStream(new QueryClient())

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(latestSource().url).toMatch(/\/api\/v1\/status\/stream$/)
  })

  it('reports live once the server acks, and interrupted when the stream drops', () => {
    const { view, source } = mountStream(new QueryClient())

    expect(view.result.current).toBe('connecting')

    act(() => source.connect())
    expect(view.result.current).toBe('live')

    act(() => source.drop())
    expect(view.result.current).toBe('interrupted')

    act(() => source.connect())
    expect(view.result.current).toBe('live')
  })

  it('invalidates nothing on connect or on an unrelated message', () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { source } = mountStream(queryClient)

    act(() => {
      source.connect()
      source.dispatchEvent(new MessageEvent('message', { data: 'ping' }))
    })

    expect(invalidate).not.toHaveBeenCalled()
  })

  it('coalesces a burst of events into one invalidation round', () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { source } = mountStream(queryClient)

    act(() => {
      source.connect()
      for (let i = 0; i < 20; i++) source.status({ match_id: 'seed01', status: 'done' })
    })

    expect(invalidate).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(INVALIDATION_DEBOUNCE_MS))

    expect(keysOf(invalidate)).toEqual([qk.matches(), qk.match('seed01')])
  })

  it('refetches the list when the stream comes back, not on the first connect', () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { source } = mountStream(queryClient)

    act(() => source.connect())
    act(() => vi.advanceTimersByTime(INVALIDATION_DEBOUNCE_MS))
    expect(invalidate).not.toHaveBeenCalled()

    act(() => {
      source.drop()
      source.connect()
    })
    act(() => vi.advanceTimersByTime(INVALIDATION_DEBOUNCE_MS))

    expect(keysOf(invalidate)).toEqual([qk.matches()])
  })

  it('drops a malformed payload instead of poisoning the cache', () => {
    vi.useFakeTimers()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { source } = mountStream(queryClient)

    act(() => {
      source.connect()
      source.status('not json at all')
      source.status({ match_id: 'm1', status: 'wat' })
    })
    act(() => vi.advanceTimersByTime(INVALIDATION_DEBOUNCE_MS))

    expect(invalidate).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledTimes(2)
  })

  it('closes the connection on unmount', () => {
    const { view, source } = mountStream(new QueryClient())

    view.unmount()

    expect(source.closed).toBe(true)
  })

  // Every composed story mounts AppProviders, and jsdom has no EventSource.
  it('is a no-op where EventSource does not exist', () => {
    vi.stubGlobal('EventSource', undefined)

    const queryClient = new QueryClient()
    const view = renderHook(() => useStatusStream(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })

    expect(view.result.current).toBe('connecting')
    expect(FakeEventSource.instances).toHaveLength(0)
  })
})
