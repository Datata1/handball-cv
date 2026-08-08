import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  ApiError,
  deleteMatch,
  getScoreboardSummary,
  listMatches,
  type MatchMeta,
  type MatchPatch,
  patchMatch,
} from '@/shared/api'
import { hasProcessingMatch, mayBeFrozen, qk, staleTime } from '@/shared/query'

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

/** The three names `PATCH /matches/{id}` accepts. */
export type MatchNameField = 'display_name' | 'team_a_name' | 'team_b_name'

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
 * Rename and delete, as one bundle the list threads down to its cards.
 *
 * One mutation each rather than one per card: an optimistic delete unmounts the
 * card that started it, and a hook that unmounts takes its own error state with
 * it. Only one match is ever being renamed or deleted at a time, so the mutation
 * variables are enough to say which card the pending or failed state belongs to.
 */
export function useMatchMutations(): MatchMutations {
  const queryClient = useQueryClient()

  const rename = useMutation({
    mutationFn: ({ matchId, field, value }: RenameVariables) =>
      patchMatch(matchId, namePatch(field, value)),

    onMutate: async ({ matchId, field, value }) => {
      await queryClient.cancelQueries({ queryKey: qk.matches() })
      const previous = queryClient.getQueryData<MatchMeta[]>(qk.matches())

      queryClient.setQueryData<MatchMeta[]>(qk.matches(), (matches) =>
        matches?.map((match) =>
          match.match_id === matchId ? { ...match, ...namePatch(field, value) } : match,
        ),
      )

      return { previous }
    },

    onError: (_error, _variables, context) => {
      queryClient.setQueryData(qk.matches(), context?.previous)
    },

    // The backend keys its stats cache on the match meta it just rewrote.
    onSuccess: (_result, { matchId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.stats(matchId) })
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.matches() }),
  })

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

  const renamingVariables = rename.isPending ? rename.variables : undefined
  const failedRename = rename.isError ? rename.variables : undefined

  return {
    rename: (matchId, field, value) => rename.mutate({ matchId, field, value }),
    remove: (matchId) => remove.mutate(matchId),

    saving: renamingVariables
      ? { matchId: renamingVariables.matchId, field: renamingVariables.field }
      : null,

    renameFailed: failedRename
      ? { matchId: failedRename.matchId, field: failedRename.field }
      : null,

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

interface RenameVariables {
  matchId: string
  field: MatchNameField
  value: string
}

// A body with no fields at all is a 400, and `null` means "leave this alone" —
// so a patch always carries exactly the one field being renamed.
function namePatch(field: MatchNameField, value: string): MatchPatch {
  const patch: MatchPatch = {}
  patch[field] = value

  return patch
}
