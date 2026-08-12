import { useQuery } from '@tanstack/react-query'

import { getFormationSummary } from '@/shared/api'
import { qk, staleTime } from '@/shared/query'

/**
 * The formation distribution of both teams.
 *
 * The only request this section adds — the scenes it drills into are the ones
 * the shell already fetched for the timeline. It is the expensive half: the
 * route materialises the full per-frame list server-side and counts it in
 * Python, which is the cost `/formations` would have charged the client. Hence
 * `staleTime.formationSummary`, the longest in the app.
 */
export function useFormationSummary(matchId: string) {
  return useQuery({
    queryKey: qk.formationSummary(matchId),
    queryFn: ({ signal }) => getFormationSummary(matchId, signal),
    staleTime: staleTime.formationSummary,
  })
}
