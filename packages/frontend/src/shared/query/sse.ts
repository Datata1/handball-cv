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

/**
 * Long enough to swallow the refetch → status-rewrite → event burst described
 * below, short enough that a real transition still feels immediate.
 */
export const INVALIDATION_DEBOUNCE_MS = 300

/** Above this many invalidation rounds per minute, something is looping. */
const FLUSH_WARN_PER_MINUTE = 20

/**
 * What the user is told about the push channel.
 *
 * `connecting` covers the first connection attempt and every environment with
 * no `EventSource` at all. `interrupted` means the stream dropped — the app
 * still works, but it has stopped learning about ingests on its own.
 */
export type StreamState = 'connecting' | 'live' | 'interrupted'

export const StatusStreamContext = createContext<StreamState>('connecting')

/** Reads the live connection state. Anything below `AppProviders` may call it. */
export function useStatusStreamState(): StreamState {
  return use(StatusStreamContext)
}

/**
 * Opens the app's single `EventSource` and turns status events into scoped
 * cache invalidation. Mounted once, by `AppProviders`.
 *
 * Returns the connection state so the shell can surface a dropped stream —
 * the legacy app installed `es.onerror = () => {}` and showed the user a
 * dashboard that had quietly stopped updating.
 */
export function useStatusStream(): StreamState {
  const queryClient = useQueryClient()
  const [state, setState] = useState<StreamState>('connecting')

  useEffect(() => {
    // jsdom has no EventSource, and neither does a prerender. Stories and tests
    // must not open a connection, so absence is a silent no-op rather than a
    // crash in every composed story.
    if (typeof EventSource === 'undefined') return

    const bridge = createStatusBridge(queryClient)
    const source = new EventSource(statusStreamUrl())
    let everConnected = false

    // The server's own ack, yielded by the generator — not the transport-level
    // `open`. Every reconnect re-runs the generator, so this fires again.
    source.addEventListener('connected', () => {
      setState('live')
      // There is no `id:` field on this stream, so a reconnect cannot resume:
      // whatever happened during the gap is simply gone. Refetch instead.
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

    // EventSource retries on its own, so this is a state change and not an
    // error path. `: heartbeat` never lands here — it is a comment, and the
    // browser drops it before any listener runs.
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
  handleReconnect(): void
  /** Runs a pending round immediately. Exposed for tests. */
  flush(): void
  /** Rounds run in the last 60s — the dev-only storm detector reads this. */
  flushesInLastMinute(): number
  dispose(): void
}

/**
 * Coalesces status events into invalidation rounds.
 *
 * **The feedback loop this exists for:** `GET /matches` is side-effecting. It
 * rewrites `unknown`/`processing` status files to `done`
 * (`routes/matches.py:155`), and every rewrite emits an SSE `status` event. So
 * refetching the list on each event feeds the stream that triggered the
 * refetch. It converges — a `done` match is not rewritten again — but naively
 * it converges through a burst. Debouncing turns the burst into one round.
 *
 * **Why the freeze sweep:** `query_duckdb` returns `[]` while *any* match is
 * processing. List endpoints therefore answer `[]` — a perfectly valid response
 * that gets cached as a successful empty result for up to its staleTime. So the
 * bridge tracks which matches are processing, and when the last one finishes it
 * invalidates everything rather than just the match that changed. Without that,
 * a report opened during someone else's ingest stays empty for half an hour.
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
      // `qk.all()` is a prefix of the list and of every match subtree, so this
      // is one call, not one per match.
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

  /**
   * The cache is the only record of matches that were already processing when
   * this tab connected — those transitions produced no event we saw.
   */
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

      // Any transition changes the list: its `status` column is what moved.
      pendingList = true

      // `done` is the only status that makes new data readable. `failed` and
      // `processing` leave the match with nothing worth fetching.
      if (event.status === 'done') pendingMatches.add(event.match_id)

      // The last ingest finished, so the global read freeze has lifted and
      // anything cached during it may be a false empty.
      if (wasFrozen && processing.size === 0) pendingSweep = true

      schedule()
    },

    handleReconnect() {
      if (disposed) return

      pendingList = true
      // We were mid-ingest when the stream dropped, so the `done` event that
      // lifted the freeze is one of the events we missed.
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

/** Keeps a rolling minute of rounds, and complains in dev if they pile up. */
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
