import { fn } from 'storybook/test'

import type { MatchMutations } from '../queries'

/**
 * An idle `useMatchMutations()`, for the stories that are not about a mutation.
 * Pass the one field a story does care about.
 */
export function mutations(state: Partial<MatchMutations> = {}): MatchMutations {
  return {
    rename: fn(),
    remove: fn(),
    saving: null,
    renameFailed: null,
    deleteFailed: null,
    ...state,
  }
}
