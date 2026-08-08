import './configure'

import { PlayerStore } from './player'

/**
 * Client state only — view state that no URL and no server response owns.
 * Anything fetched over HTTP belongs in TanStack Query instead.
 */
export class RootStore {
  readonly player = new PlayerStore()
}

export function createRootStore(): RootStore {
  return new RootStore()
}
