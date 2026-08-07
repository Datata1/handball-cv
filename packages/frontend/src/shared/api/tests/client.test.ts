import { z } from 'zod'

import { BACKEND_URL } from '@/lib/env'

import { apiUrl, formatTrackIds, request } from '../client'
import {
  ApiError,
  ApiTransportError,
  ApiValidationError,
  apiErrorKey,
  isApiError,
} from '../errors'

const schema = z.object({ ok: z.boolean() })

function respondWith(body: unknown, init: ResponseInit = {}) {
  const fetchMock = vi.fn(
    async () =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' },
        ...init,
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('apiUrl', () => {
  it('resolves against the one BACKEND_URL and prefixes every path', () => {
    expect(apiUrl('/matches')).toBe(`${BACKEND_URL}/api/v1/matches`)
  })

  it('drops undefined and null params so an unset filter is simply absent', () => {
    const url = new URL(
      apiUrl('/matches/m1/heatmap-points', {
        phase_id: 3,
        track_ids: undefined,
        perspective: null,
        window_start_s: 0,
      }),
    )

    expect([...url.searchParams]).toEqual([
      ['phase_id', '3'],
      ['window_start_s', '0'],
    ])
  })
})

describe('request', () => {
  it('returns parsed data on success', async () => {
    respondWith({ ok: true })

    await expect(request('/x', schema)).resolves.toEqual({ ok: true })
  })

  it('throws an ApiError carrying the status and FastAPI detail', async () => {
    respondWith({ detail: 'Match not found' }, { status: 404 })

    const error = await request('/matches/m1/stats', schema).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, detail: 'Match not found' })
  })

  it('keeps the issue array of a 422 intact', async () => {
    respondWith(
      {
        detail: [
          {
            loc: ['body', 'display_name'],
            msg: 'Input should be a valid string',
            type: 'string_type',
          },
        ],
      },
      { status: 422 },
    )

    const error = (await request('/matches/m1', schema).catch(
      (e: unknown) => e,
    )) as ApiError

    expect(Array.isArray(error.detail)).toBe(true)
    expect(error.message).toContain('body.display_name')
  })

  it('falls back to the raw text when the error body is not FastAPI-shaped', async () => {
    respondWith('<html>502 Bad Gateway</html>', { status: 502 })

    await expect(request('/x', schema)).rejects.toMatchObject({
      status: 502,
      detail: '<html>502 Bad Gateway</html>',
    })
  })

  it('throws an ApiValidationError naming the offending field on shape drift', async () => {
    respondWith({ ok: 'yes' })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const error = await request('/matches', schema).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiValidationError)
    expect((error as ApiValidationError).issues).toContain('ok')
    expect((error as ApiValidationError).path).toBe('/matches')
  })

  it('throws an ApiTransportError when the request never reaches the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    )

    await expect(request('/x', schema)).rejects.toBeInstanceOf(ApiTransportError)
  })

  it('never throws a display string — every failure is a typed error', async () => {
    respondWith({ detail: 'Nicht gefunden' }, { status: 404 })

    const error = await request('/x', schema).catch((e: unknown) => e)

    expect(isApiError(error)).toBe(true)
  })
})

describe('formatTrackIds', () => {
  it('joins integers for the wire', () => {
    expect(formatTrackIds([3, 1, 7])).toBe('3,1,7')
  })

  it('treats an empty selection as no filter, matching the backend', () => {
    expect(formatTrackIds([])).toBeUndefined()
    expect(formatTrackIds(undefined)).toBeUndefined()
  })

  // The route does a bare int() in an uncaught comprehension: a bad value is a
  // 500, not a 422. It has to fail here instead.
  it.each([[1.5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'rejects %s before it reaches the wire',
    (bad) => {
      expect(() => formatTrackIds([1, bad])).toThrow(TypeError)
    },
  )
})

describe('apiErrorKey', () => {
  it.each([
    ['errors.unreachable', new ApiTransportError('/x', new TypeError())],
    ['errors.invalidResponse', new ApiValidationError('/x', 'bad')],
    ['errors.notFound', new ApiError(404, 'nope', '/x')],
    ['errors.unexpected', new ApiError(500, 'boom', '/x')],
    ['errors.unexpected', new Error('something else')],
  ])('maps to %s', (key, error) => {
    expect(apiErrorKey(error)).toBe(key)
  })
})
