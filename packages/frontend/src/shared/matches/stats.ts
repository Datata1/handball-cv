import { queryOptions } from '@tanstack/react-query'

import { getMatchStats } from '@/shared/api'
import { qk, staleTime } from '@/shared/query'

/**
 * The tracking statistics of one match, as options rather than a hook: the
 * overview section reads the possession split and the processing diagnostics
 * out of it, the players section reads `player_stats` out of the same response.
 *
 * Ten DuckDB queries and four full table scans per call, so the two sections
 * have to describe it identically or a section change pays for it twice.
 */
export function matchStatsOptions(matchId: string) {
  return queryOptions({
    queryKey: qk.stats(matchId),
    queryFn: ({ signal }) => getMatchStats(matchId, signal),
    staleTime: staleTime.stats,
  })
}
