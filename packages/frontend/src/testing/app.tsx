import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { type RenderResult, render } from '@testing-library/react'

import { AppProviders } from '@/app/providers'
import { createAppRouter } from '@/app/router'

/**
 * Mounts the **real** route tree at a URL, over an in-memory history — the only
 * way to assert on things that are properties of the tree rather than of a
 * component: deep links, redirects, back/forward, and the not-found boundary.
 *
 * Distinct from `withRouter()` in `testing/router.tsx`, which fabricates a
 * throwaway tree so a story can render a `<Link>` in isolation.
 */
export function renderApp(initialPath = '/'): RenderResult & {
  router: ReturnType<typeof createAppRouter>
} {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialPath] }))

  return {
    router,
    ...render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    ),
  }
}
