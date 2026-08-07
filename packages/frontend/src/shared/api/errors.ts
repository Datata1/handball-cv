import type resources from '@/i18n/resources'

import type { ValidationIssue } from './schemas/common'

/**
 * Everything this layer throws.
 *
 * None of them carry a display string: the message is English developer text
 * for the console, and components render `t(apiErrorKey(error))` instead. The
 * legacy data layer threw German copy, which is why its error text could never
 * be translated and why the same sentence appeared in three components.
 */
export type AnyApiError = ApiError | ApiValidationError | ApiTransportError

/** A non-2xx response. `detail` is FastAPI's, verbatim. */
export class ApiError extends Error {
  override readonly name = 'ApiError'

  constructor(
    readonly status: number,
    /** `string` for `HTTPException`, issue array for a 422. */
    readonly detail: string | ValidationIssue[],
    readonly path: string,
  ) {
    super(`${status} from ${path}: ${summarise(detail)}`)
  }
}

/** A 2xx response whose body did not match the schema — a backend contract change. */
export class ApiValidationError extends Error {
  override readonly name = 'ApiValidationError'

  constructor(
    readonly path: string,
    /** `z.prettifyError` output — names the offending field. */
    readonly issues: string,
  ) {
    super(`Response from ${path} did not match its schema:\n${issues}`)
  }
}

/** The request never produced a response: offline, DNS, CORS, aborted. */
export class ApiTransportError extends Error {
  override readonly name = 'ApiTransportError'

  constructor(
    readonly path: string,
    override readonly cause: unknown,
  ) {
    super(`Request to ${path} failed to reach the server`)
  }
}

export function isApiError(error: unknown): error is AnyApiError {
  return (
    error instanceof ApiError ||
    error instanceof ApiValidationError ||
    error instanceof ApiTransportError
  )
}

/** Keys under `errors` in the `common` namespace — checked against the catalogue. */
type ErrorKey = `errors.${keyof (typeof resources)['common']['errors']}`

/**
 * Maps a thrown error to an i18n key, so a component can render it with one
 * `t()` call and no `instanceof` ladder of its own.
 *
 * Deliberately coarse. A trainer cannot act on the difference between a 500 and
 * a 503, and `detail` is English text from FastAPI — never show it. Anything
 * finer-grained belongs to the feature: a 404 on a match the dashboard listed
 * means something different than a 404 on a typed URL, and only the feature
 * knows which it is.
 */
export function apiErrorKey(error: unknown): ErrorKey {
  if (error instanceof ApiTransportError) return 'errors.unreachable'
  if (error instanceof ApiValidationError) return 'errors.invalidResponse'
  if (error instanceof ApiError && error.status === 404) return 'errors.notFound'
  return 'errors.unexpected'
}

function summarise(detail: string | ValidationIssue[]): string {
  if (typeof detail === 'string') return detail

  return detail.map((issue) => `${issue.loc.join('.')}: ${issue.msg}`).join('; ')
}
