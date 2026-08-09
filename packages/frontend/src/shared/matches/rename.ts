import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type MatchMeta, type MatchPatch, patchMatch } from '@/shared/api'
import { qk } from '@/shared/query'

/** The three names `PATCH /matches/{id}` accepts. */
export type MatchNameField = 'display_name' | 'team_a_name' | 'team_b_name'

export interface MatchRename {
  rename: (matchId: string, field: MatchNameField, value: string) => void
  /** The rename in flight, if any. */
  saving: { matchId: string; field: MatchNameField } | null
  /** The rename that failed and has not been retried since. */
  failed: { matchId: string; field: MatchNameField } | null
}

/**
 * Correcting one of a match's three names, optimistically.
 *
 * One mutation for the whole app rather than one per field or per card: only
 * one name is ever being edited at a time, so the mutation variables are enough
 * to say which field the pending or failed state belongs to — and a hook that
 * unmounts with its card would take its own error state with it.
 *
 * The optimistic write goes into the match *list*, which is where both callers
 * read a match from.
 */
export function useRenameMatch(): MatchRename {
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

  const pending = rename.isPending ? rename.variables : undefined
  const failed = rename.isError ? rename.variables : undefined

  return {
    rename: (matchId, field, value) => rename.mutate({ matchId, field, value }),
    saving: pending ? { matchId: pending.matchId, field: pending.field } : null,
    failed: failed ? { matchId: failed.matchId, field: failed.field } : null,
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
