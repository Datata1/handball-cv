import type { MatchMeta, MatchStatus } from '@/shared/api'

import { matchTitle } from './matches'

/** The statuses worth saying out loud. `unknown` is the absence of news. */
const ANNOUNCED = ['processing', 'done', 'failed'] as const

export type AnnouncedStatus = (typeof ANNOUNCED)[number]

function isAnnounced(status: MatchStatus): status is AnnouncedStatus {
  return (ANNOUNCED as readonly MatchStatus[]).includes(status)
}

export interface StatusChange {
  matchId: string
  title: string
  status: AnnouncedStatus
}

export function statusesById(
  matches: readonly MatchMeta[],
): ReadonlyMap<string, MatchStatus> {
  return new Map(matches.map((match) => [match.match_id, match.status]))
}

/**
 * What changed since the last list, for a reader who is not looking at the
 * cards. The list arrives by SSE-driven refetch, so nothing the user did caused
 * it and nothing else on the page reports it.
 *
 * A match the previous list did not have counts as a change: an upload finishes
 * in another tab and the row appears mid-ingestion, which is exactly the thing
 * worth hearing. A match that disappeared does not — the user deleted it, and
 * the button they pressed said so.
 */
export function statusChanges(
  previous: ReadonlyMap<string, MatchStatus>,
  matches: readonly MatchMeta[],
): StatusChange[] {
  return matches.flatMap((match) =>
    previous.get(match.match_id) !== match.status && isAnnounced(match.status)
      ? [{ matchId: match.match_id, title: matchTitle(match), status: match.status }]
      : [],
  )
}
