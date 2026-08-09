import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { ApiError, deleteMatch, listMatches, type MatchMeta } from '@/shared/api'
import {
  finalScore,
  type MatchNameField,
  type MatchScore,
  scoreboardSummaryOptions,
  useRenameMatch,
} from '@/shared/matches'
import { hasProcessingMatch, qk, staleTime } from '@/shared/query'

export type { MatchNameField, MatchScore }

export function useMatches() {
  return useQuery({
    queryKey: qk.matches(),
    queryFn: ({ signal }) => listMatches(signal),
    staleTime: staleTime.matches,
  })
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
    queries: ids.map((matchId) => scoreboardSummaryOptions(matchId, queryClient)),
  })

  return new Map(
    results.flatMap((result, index) => {
      const matchId = ids[index]

      return matchId === undefined || result.data === undefined
        ? []
        : [[matchId, finalScore(result.data)] as const]
    }),
  )
}

export interface MatchMutations {
  rename: (matchId: string, field: MatchNameField, value: string) => void
  remove: (matchId: string) => void
  /** The rename in flight, if any. */
  saving: { matchId: string; field: MatchNameField } | null
  /** The rename that failed and has not been retried since. */
  renameFailed: { matchId: string; field: MatchNameField } | null
  /**
   * The delete that failed. `blocked` marks a 404 that may be the read freeze
   * rather than a missing match, which is a different sentence to the user and
   * a different thing to do about it.
   */
  deleteFailed: { matchId: string; blocked: boolean } | null
}

/**
 * Rename and delete, as one bundle the list threads down to its cards. The
 * rename half is shared with the report's header — see `useRenameMatch`.
 *
 * One delete mutation rather than one per card: an optimistic delete unmounts
 * the card that started it, and a hook that unmounts takes its own error state
 * with it. Only one match is ever being deleted at a time, so the mutation
 * variables are enough to say which card the failed state belongs to.
 */
export function useMatchMutations(): MatchMutations {
  const queryClient = useQueryClient()
  const rename = useRenameMatch()

  const remove = useMutation({
    mutationFn: (matchId: string) => deleteMatch(matchId),

    onMutate: async (matchId) => {
      await queryClient.cancelQueries({ queryKey: qk.matches() })
      const previous = queryClient.getQueryData<MatchMeta[]>(qk.matches())

      queryClient.setQueryData<MatchMeta[]>(qk.matches(), (matches) =>
        matches?.filter((match) => match.match_id !== matchId),
      )

      return { previous }
    },

    // Deliberately no refetch here. A delete fails most often while a match is
    // processing, and `GET /matches` answers that with status-file stubs for
    // every match — so refetching would replace the list we just restored with
    // a worse one.
    onError: (_error, _matchId, context) => {
      queryClient.setQueryData(qk.matches(), context?.previous)
    },

    onSuccess: (_result, matchId) => {
      queryClient.removeQueries({ queryKey: qk.match(matchId) })
      void queryClient.invalidateQueries({ queryKey: qk.matches() })
    },
  })

  return {
    rename: rename.rename,
    remove: (matchId) => remove.mutate(matchId),
    saving: rename.saving,
    renameFailed: rename.failed,

    deleteFailed:
      remove.isError && remove.variables !== undefined
        ? {
            matchId: remove.variables,
            // A 404 from DELETE is not proof the match is gone: the row lookup
            // it answers goes through the same frozen read as everything else.
            blocked:
              remove.error instanceof ApiError &&
              remove.error.status === 404 &&
              hasProcessingMatch(queryClient),
          }
        : null,
  }
}
