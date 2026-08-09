import { type QueryClient, queryOptions } from '@tanstack/react-query'

import { ApiError, getScoreboardSummary, type ScoreboardSummary } from '@/shared/api'
import { mayBeFrozen, qk, staleTime } from '@/shared/query'

export interface MatchScore {
  home: number
  away: number
}

/**
 * The scoreboard summary, as options rather than a hook: the dashboard runs one
 * per card through `useQueries`, the report runs one for the match it is
 * showing. Both have to describe the query the same way, or the two shapes race
 * for one cache entry.
 *
 * `null` means the match has no scoreboard readings at all.
 */
export function scoreboardSummaryOptions(matchId: string, queryClient: QueryClient) {
  return queryOptions({
    queryKey: qk.scoreboardSummary(matchId),
    queryFn: async ({ signal }): Promise<ScoreboardSummary | null> => {
      try {
        return await getScoreboardSummary(matchId, signal)
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
  })
}

/** The final score, or `null` when the OCR never read a complete one. */
export function finalScore(summary: ScoreboardSummary | null): MatchScore | null {
  if (
    summary === null ||
    summary.final_score_home === null ||
    summary.final_score_away === null
  ) {
    return null
  }

  return { home: summary.final_score_home, away: summary.final_score_away }
}
