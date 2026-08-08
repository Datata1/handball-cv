import { createContext, type ReactNode, use, useState } from 'react'

import type { PlayerStore } from './player'
import { createRootStore, type RootStore } from './root'

const StoreContext = createContext<RootStore | null>(null)

/**
 * Mounts the client-state stores. `store` is for stories and tests that need a
 * specific state; the app lets it build its own.
 */
export function StoreProvider({
  store,
  children,
}: {
  store?: RootStore
  children: ReactNode
}) {
  // Per mount rather than a module singleton, so stories and tests never share
  // a player.
  const [fallback] = useState(() => store ?? createRootStore())

  return <StoreContext value={store ?? fallback}>{children}</StoreContext>
}

export function useStores(): RootStore {
  const store = use(StoreContext)
  if (!store) throw new Error('useStores() was called outside a StoreProvider')
  return store
}

export function usePlayer(): PlayerStore {
  return useStores().player
}
