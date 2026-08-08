import type { Decorator } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { type ComponentType, useState } from 'react'

/**
 * Mounts a story inside a throwaway in-memory router, so a component that
 * renders `<Link>` can be storied without the real route tree.
 *
 * The tree is a root plus a splat, so every `to` a component might build
 * resolves to *something* — a link renders its href and navigating goes
 * nowhere visible, rather than throwing.
 */
export function withRouter(initialPath = '/'): Decorator {
  return (Story) => <RoutedStory Story={Story} initialPath={initialPath} />
}

function RoutedStory({
  Story,
  initialPath,
}: {
  Story: ComponentType
  initialPath: string
}) {
  // Once per mount: rebuilding the router on every render remounts the story.
  const [router] = useState(() => buildRouter(Story, initialPath))

  return <RouterProvider router={router} />
}

function buildRouter(Story: ComponentType, initialPath: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Story />
        <Outlet />
      </>
    ),
  })

  const catchAll = createRoute({
    getParentRoute: () => rootRoute,
    path: '$',
    component: () => null,
  })

  return createRouter({
    routeTree: rootRoute.addChildren([catchAll]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
}
