import './configure'

import { PlayerStore } from './player'
import { SelectionStore } from './selection'

/**
 * Client state only — view state that no URL and no server response owns.
 * Anything fetched over HTTP belongs in TanStack Query instead.
 */
export class RootStore {
  readonly player = new PlayerStore()
  readonly selection = new SelectionStore()
}

export function createRootStore(): RootStore {
  return new RootStore()
}
