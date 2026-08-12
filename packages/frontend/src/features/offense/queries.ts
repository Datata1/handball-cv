import { useQuery } from '@tanstack/react-query'

import { getPlaySummary } from '@/shared/api'
import { qk, staleTime } from '@/shared/query'

/**
 * How often each play type was detected, and how many of those attacks scored.
 *
 * The only request this section adds — the events it drills into are the ones
 * the shell already fetched for the timeline. `/attacks` stays unused: the
 * outcome it carries reaches the client on the events themselves, and the
 * databases where that join is missing have no `sequence_id` to look up either.
 */
export function usePlaySummary(matchId: string) {
  return useQuery({
    queryKey: qk.playSummary(matchId),
    queryFn: ({ signal }) => getPlaySummary(matchId, signal),
    staleTime: staleTime.playSummary,
  })
}
