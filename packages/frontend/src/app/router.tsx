import { createRouter, type RouterHistory } from '@tanstack/react-router'

import { routeTree } from '@/routeTree.gen'

import { RouteError } from './components/RouteError'
import { RouteNotFound } from './components/RouteNotFound'
import { RoutePending } from './components/RoutePending'

/**
 * The app's router, as a factory so tests can drive the real route tree over
 * an in-memory history instead of the browser's.
 *
 * The three boundaries are set here rather than on `__root`: a route falls back
 * to the *router's* default, not to its parent's, so a per-route
 * `errorComponent` on the root would never cover a section route.
 */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    defaultPreload: 'intent',
    scrollRestoration: true,

    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
    defaultPendingComponent: RoutePending,

    // A loader that finishes inside 500ms shows nothing at all; once the
    // skeleton is up it stays 300ms, so a slightly slower one does not strobe.
    defaultPendingMs: 500,
    defaultPendingMinMs: 300,
  })
}

// Makes <Link to="…">, useParams() and useSearch() aware of the concrete route
// tree, so a typo in a path is a type error rather than a runtime 404.
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
