import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, use, useEffect, useState } from 'react'

import {
  type MatchMeta,
  type StatusEvent,
  statusEventSchema,
  statusStreamUrl,
} from '@/shared/api'

import { qk } from './keys'

export const INVALIDATION_DEBOUNCE_MS = 300

/** Above this many rounds per minute, the loop described below is not converging. */
const FLUSH_WARN_PER_MINUTE = 20

export type StreamState = 'connecting' | 'live' | 'interrupted'

export const StatusStreamContext = createContext<StreamState>('connecting')

export function useStatusStreamState(): StreamState {
  return use(StatusStreamContext)
}

/** Opens the app's single `EventSource`. Mounted once, by `AppProviders`. */
export function useStatusStream(): StreamState {
  const queryClient = useQueryClient()
  const [state, setState] = useState<StreamState>('connecting')

  useEffect(() => {
    // jsdom has none, and every composed story mounts AppProviders.
    if (typeof EventSource === 'undefined') return

    const bridge = createStatusBridge(queryClient)
    const source = new EventSource(statusStreamUrl())
    let everConnected = false

    // The server generator's own ack, not the transport-level `open`. A
    // reconnect re-runs the generator, so it fires again.
    source.addEventListener('connected', () => {
      setState('live')
      if (everConnected) bridge.handleReconnect()
      everConnected = true
    })

    source.addEventListener('status', (event) => {
      const parsed = statusEventSchema.safeParse(
        parseJson((event as MessageEvent<string>).data),
      )

      if (!parsed.success) {
        if (import.meta.env.DEV) {
          console.error(
            '[sse] unparseable status event',
            (event as MessageEvent<string>).data,
          )
        }
        return
      }

      bridge.handleEvent(parsed.data)
    })

    // EventSource reconnects on its own, so this is a state change rather than
    // a failure to handle.
    source.addEventListener('error', () => {
      setState('interrupted')
    })

    return () => {
      source.close()
      bridge.dispose()
    }
  }, [queryClient])

  return state
}

export interface StatusBridge {
  handleEvent(event: StatusEvent): void
  /** The stream carries no `id:`, so a reconnect cannot resume — it refetches. */
  handleReconnect(): void
  flush(): void
  flushesInLastMinute(): number
  dispose(): void
}

/**
 * Turns status events into scoped cache invalidation.
 *
 * Two backend behaviours shape this:
 *
 * `GET /matches` rewrites `unknown`/`processing` status files to `done`
 * (`routes/matches.py:155`), and each rewrite emits an SSE `status` event. So
 * refetching the list per event feeds the stream that triggered it. Debouncing
 * turns the resulting burst into one round.
 *
 * `query_duckdb` returns `[]` while any match is processing, so list endpoints
 * answer `[]` — a 200 that caches as a successful empty result for its full
 * staleTime. Retry policy cannot see that. Instead the bridge tracks which
 * matches are processing and invalidates everything once the last one finishes.
 */
export function createStatusBridge(
  queryClient: QueryClient,
  debounceMs: number = INVALIDATION_DEBOUNCE_MS,
): StatusBridge {
  const processing = new Set<string>()
  const pendingMatches = new Set<string>()
  const flushTimes: number[] = []

  let pendingList = false
  let pendingSweep = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  function schedule() {
    if (disposed || timer !== undefined) return
    timer = setTimeout(flush, debounceMs)
  }

  function flush() {
    timer = undefined
    if (!(pendingList || pendingSweep || pendingMatches.size > 0)) return

    if (pendingSweep) {
      void queryClient.invalidateQueries({ queryKey: qk.all() })
    } else {
      if (pendingList) void queryClient.invalidateQueries({ queryKey: qk.matches() })
      for (const matchId of pendingMatches) {
        void queryClient.invalidateQueries({ queryKey: qk.match(matchId) })
      }
    }

    pendingList = false
    pendingSweep = false
    pendingMatches.clear()
    noteFlush(flushTimes)
  }

  // Matches already processing when this tab connected produced no event we saw.
  function absorbCachedProcessing() {
    for (const match of queryClient.getQueryData<MatchMeta[]>(qk.matches()) ?? []) {
      if (match.status === 'processing') processing.add(match.match_id)
    }
  }

  return {
    handleEvent(event) {
      if (disposed) return

      absorbCachedProcessing()
      const wasFrozen = processing.size > 0

      if (event.status === 'processing') processing.add(event.match_id)
      else processing.delete(event.match_id)

      pendingList = true

      // `done` is the only status that makes new data readable.
      if (event.status === 'done') pendingMatches.add(event.match_id)

      // The read freeze has lifted; anything cached during it may be a false
      // empty.
      if (wasFrozen && processing.size === 0) pendingSweep = true

      schedule()
    },

    handleReconnect() {
      if (disposed) return

      pendingList = true
      // The event that lifted the freeze is one of the ones we missed.
      if (processing.size > 0) pendingSweep = true
      schedule()
    },

    flush() {
      if (timer !== undefined) clearTimeout(timer)
      flush()
    },

    flushesInLastMinute: () => flushTimes.length,

    dispose() {
      disposed = true
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    },
  }
}

function noteFlush(flushTimes: number[], now: number = Date.now()) {
  flushTimes.push(now)
  while (flushTimes.length > 0 && now - (flushTimes[0] ?? now) > 60_000)
    flushTimes.shift()

  if (import.meta.env.DEV && flushTimes.length > FLUSH_WARN_PER_MINUTE) {
    console.warn(
      `[sse] ${flushTimes.length} invalidation rounds in the last minute — ` +
        'the /matches status-rewrite loop may not be converging',
    )
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}
