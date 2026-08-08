import { QueryClient } from '@tanstack/react-query'

import {
  ApiError,
  ApiTransportError,
  ApiValidationError,
  matchListSchema,
} from '@/shared/api'

// Recorded from a running backend during an ingest, so this is what the read
// freeze actually looks like. See ../../api/tests/fixtures/README.md.
import matchesFixture from '../../api/tests/fixtures/matches.json'
import processingFixture from '../../api/tests/fixtures/matches-processing.json'
import { qk } from '../keys'
import {
  hasProcessingMatch,
  MAX_RETRIES,
  mayBeFrozen,
  retryDelay,
  shouldRetryMutation,
  shouldRetryQuery,
} from '../retry'

function clientWith(fixture?: unknown) {
  const queryClient = new QueryClient()
  if (fixture !== undefined) {
    queryClient.setQueryData(qk.matches(), matchListSchema.parse(fixture))
  }
  return queryClient
}

const idle = () => clientWith(matchesFixture)
const ingesting = () => clientWith(processingFixture)
const unknown = () => clientWith()

describe('hasProcessingMatch', () => {
  it('is true when any match anywhere is being ingested', () => {
    expect(hasProcessingMatch(ingesting())).toBe(true)
  })

  it('is false for a settled list, and for one never loaded', () => {
    expect(hasProcessingMatch(idle())).toBe(false)
    expect(hasProcessingMatch(unknown())).toBe(false)
  })
})

describe('mayBeFrozen', () => {
  it('treats a list we have not loaded as "cannot tell"', () => {
    expect(mayBeFrozen(unknown())).toBe(true)
    expect(mayBeFrozen(ingesting())).toBe(true)
    expect(mayBeFrozen(idle())).toBe(false)
  })
})

describe('shouldRetryQuery', () => {
  const notFound = new ApiError(404, 'Match not found', '/matches/m1/stats')

  // db.py:28 empties every read while any match is processing, and a route that
  // finds no row raises 404.
  it('retries a 404 while a match is processing', () => {
    expect(shouldRetryQuery(0, notFound, ingesting())).toBe(true)
  })

  it('treats a 404 as terminal once nothing is processing', () => {
    expect(shouldRetryQuery(0, notFound, idle())).toBe(false)
  })

  it('retries a 503, which the label endpoint returns for a busy database', () => {
    expect(shouldRetryQuery(0, new ApiError(503, 'Database busy', '/x'), idle())).toBe(
      true,
    )
  })

  it('retries transport failures and 5xx', () => {
    expect(
      shouldRetryQuery(0, new ApiTransportError('/x', new TypeError()), idle()),
    ).toBe(true)
    expect(shouldRetryQuery(0, new ApiError(500, 'boom', '/x'), idle())).toBe(true)
  })

  it('gives up on 4xx that will fail identically forever', () => {
    for (const status of [400, 403, 422]) {
      expect(shouldRetryQuery(0, new ApiError(status, 'nope', '/x'), idle())).toBe(
        false,
      )
    }
  })

  it('gives up on schema drift', () => {
    expect(shouldRetryQuery(0, new ApiValidationError('/x', 'bad'), ingesting())).toBe(
      false,
    )
  })

  it('stops after MAX_RETRIES even while frozen', () => {
    expect(shouldRetryQuery(MAX_RETRIES - 1, notFound, ingesting())).toBe(true)
    expect(shouldRetryQuery(MAX_RETRIES, notFound, ingesting())).toBe(false)
  })
})

describe('shouldRetryMutation', () => {
  it('retries only the two known-transient failures', () => {
    expect(shouldRetryMutation(0, new ApiTransportError('/x', new TypeError()))).toBe(
      true,
    )
    expect(shouldRetryMutation(0, new ApiError(503, 'Database busy', '/x'))).toBe(true)
  })

  it('does not retry a 500 or a 404', () => {
    expect(shouldRetryMutation(0, new ApiError(500, 'boom', '/x'))).toBe(false)
    expect(shouldRetryMutation(0, new ApiError(404, 'gone', '/x'))).toBe(false)
  })
})

describe('retryDelay', () => {
  it('backs off exponentially and then caps', () => {
    expect([0, 1, 2].map(retryDelay)).toEqual([1000, 2000, 4000])
    expect(retryDelay(20)).toBe(30_000)
  })
})
