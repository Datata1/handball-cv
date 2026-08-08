import { vi } from 'vitest'

import { API_PREFIX } from '@/shared/api'

/**
 * Stubs `fetch` for the tests that mount the real app, which are the only ones
 * that reach the network — everything else renders a composed story with the
 * data already in props.
 *
 * Keys are API paths without the `/api/v1` prefix. An unlisted path answers
 * 404 with FastAPI's error body, the way the backend does for a match it has
 * no rows for.
 */
export function stubApi(routes: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const path = url.pathname.slice(API_PREFIX.length)

    const body = Object.hasOwn(routes, path)
      ? { payload: routes[path], status: 200 }
      : { payload: { detail: 'Not found' }, status: 404 }

    return new Response(JSON.stringify(body.payload), {
      status: body.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}
