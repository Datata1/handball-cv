import type { Decorator } from '@storybook/react-vite'
import { type ReactNode, useState } from 'react'

import { createRootStore, type RootStore, StoreProvider } from '@/stores'

/**
 * Gives a story its own `RootStore`, optionally built into a specific state:
 *
 * ```tsx
 * decorators: [withStores((store) => store.player.setClip({ start: 12, end: 20 }))]
 * ```
 *
 * The app's providers already supply a store, so this is only needed when a
 * story has to *set* one up — which is how a player-driven component is storied
 * without a real video.
 */
export function withStores(build?: (store: RootStore) => void): Decorator {
  function StoryStores({ children }: { children: ReactNode }) {
    const [store] = useState(() => {
      const created = createRootStore()
      build?.(created)
      return created
    })

    return <StoreProvider store={store}>{children}</StoreProvider>
  }

  return (Story) => (
    <StoryStores>
      <Story />
    </StoryStores>
  )
}
