import type { z } from 'zod'
import { prettifyError } from 'zod'

import { BACKEND_URL } from '@/lib/env'

import { ApiError, ApiTransportError, ApiValidationError } from './errors'
import { errorBodySchema } from './schemas/common'

/** Every route in this backend is mounted under one prefix. */
export const API_PREFIX = '/api/v1'

export type QueryValue = string | number | boolean | undefined | null

/** Undefined and null values are dropped, so an unset filter is simply absent. */
export type QueryParams = Record<string, QueryValue>

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  query?: QueryParams
  body?: BodyInit | null
}

/**
 * Builds an absolute API URL. Exported because the binary endpoints
 * (`/video`, `/thumbnail`) are `src` attributes, never fetched.
 */
export function apiUrl(path: string, query?: QueryParams): string {
  const url = new URL(`${API_PREFIX}${path}`, BACKEND_URL)

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }

  return url.toString()
}

/**
 * The single seam between the app and the backend: fetch, check the status,
 * validate the body.
 *
 * Nothing here throws a string a user could be shown — see `errors.ts`.
 */
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const { query, ...init } = options
  const url = apiUrl(path, query)

  let response: Response
  try {
    response = await fetch(url, init)
  } catch (cause) {
    throw new ApiTransportError(path, cause)
  }

  if (!response.ok)
    throw new ApiError(response.status, await readDetail(response), path)

  let payload: unknown
  try {
    payload = await response.json()
  } catch (cause) {
    throw new ApiTransportError(path, cause)
  }

  const result = schema.safeParse(payload)
  if (!result.success) {
    if (import.meta.env.DEV) {
      // The prettified issues name the field; you still want the payload that
      // produced them, and it is gone by the time the error surfaces in the UI.
      console.error(`[api] ${path} failed validation`, { payload, error: result.error })
    }

    throw new ApiValidationError(path, prettifyError(result.error))
  }

  return result.data
}

/** JSON request init for the mutating endpoints. */
export function jsonBody(value: unknown): RequestOptions {
  return {
    body: JSON.stringify(value),
    headers: { 'Content-Type': 'application/json' },
  }
}

/**
 * Builds the `track_ids` query param.
 *
 * Malformed input is a **500** on this backend, not a 422 — the route does a
 * bare `int(t)` inside an uncaught comprehension. So the param is built here
 * from numbers the client already holds, and anything else fails loudly before
 * it reaches the wire. Never pass user-typed text to a caller of this.
 *
 * An empty selection returns `undefined`, matching the backend's own reading of
 * an empty parameter: no filter rather than "match nothing".
 */
export function formatTrackIds(trackIds?: readonly number[]): string | undefined {
  if (trackIds === undefined || trackIds.length === 0) return undefined

  for (const id of trackIds) {
    if (!Number.isSafeInteger(id)) {
      throw new TypeError(`track_ids must be integers, received ${String(id)}`)
    }
  }

  return trackIds.join(',')
}

/**
 * FastAPI's error body, or the raw text when a proxy or a crash produced
 * something else. Never throws: it is already handling a failure.
 */
async function readDetail(response: Response) {
  let text: string
  try {
    text = await response.text()
  } catch {
    return response.statusText
  }

  try {
    const parsed = errorBodySchema.safeParse(JSON.parse(text))
    if (parsed.success) return parsed.data.detail
  } catch {
    // Not JSON — fall through to the raw text.
  }

  return text.slice(0, 500) || response.statusText
}
