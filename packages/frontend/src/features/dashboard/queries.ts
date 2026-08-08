import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  ApiError,
  getScoreboardSummary,
  listMatches,
  type MatchMeta,
} from '@/shared/api'
import { mayBeFrozen, qk, staleTime } from '@/shared/query'

export function useMatches() {
  return useQuery({
    queryKey: qk.matches(),
    queryFn: ({ signal }) => listMatches(signal),
    staleTime: staleTime.matches,
  })
}

export interface MatchScore {
  home: number
  away: number
}

export type MatchScores = ReadonlyMap<string, MatchScore | null>

/**
 * The latest score of each finished match, keyed by match id. `null` means the
 * match has no scoreboard readings; an absent key means the score has not
 * arrived or could not be fetched, and the card then shows none.
 *
 * One query per match — there is no bulk endpoint — but against
 * `/scoreboard/summary`, not `/scoreboard`: the latter returns every OCR
 * reading, thousands of rows per match, to get at the last one.
 */
export function useMatchScores(matches: readonly MatchMeta[]): MatchScores {
  const queryClient = useQueryClient()
  const ids = matches
    .filter((match) => match.status === 'done')
    .map((match) => match.match_id)

  const results = useQueries({
    queries: ids.map((matchId) => ({
      queryKey: qk.scoreboardSummary(matchId),
      queryFn: async ({ signal }) => {
        try {
          const summary = await getScoreboardSummary(matchId, signal)

          return summary.final_score_home === null || summary.final_score_away === null
            ? null
            : { home: summary.final_score_home, away: summary.final_score_away }
        } catch (error) {
          // A match with no readings 404s, and "no score" is an answer rather
          // than a failure — but every match 404s while reads are frozen, and
          // that one has to stay retryable.
          if (
            error instanceof ApiError &&
            error.status === 404 &&
            !mayBeFrozen(queryClient)
          ) {
            return null
          }

          throw error
        }
      },
      staleTime: staleTime.scoreboardSummary,
    })),
  })

  return new Map(
    results.flatMap((result, index) => {
      const matchId = ids[index]

      return matchId === undefined || result.data === undefined
        ? []
        : [[matchId, result.data] as const]
    }),
  )
}
