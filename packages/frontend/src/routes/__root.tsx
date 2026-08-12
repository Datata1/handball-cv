import { createRootRoute, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

import { MainNav } from '@/app/components/MainNav'
import { RouteFocusProvider, useRouteFocus } from '@/app/components/RouteFocus'
import { RouteNotFound } from '@/app/components/RouteNotFound'
import { MAIN_CONTENT_ID } from '@/app/focus'
import { LiveConnectionIndicator } from '@/shared/query'
import { AppHeader, Page } from '@/shared/ui'

// Devtools are dev-only: in a production build this resolves to a component
// that renders nothing, so the package never reaches the bundle.
const RouterDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import('@tanstack/react-router-devtools').then((mod) => ({
        default: mod.TanStackRouterDevtools,
      })),
    )

// Here rather than in providers.tsx so it stays out of the tree every story
// renders.
const QueryDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import('@tanstack/react-query-devtools').then((mod) => ({
        default: mod.ReactQueryDevtools,
      })),
    )

export const Route = createRootRoute({
  component: AppShell,
  // Also set as the router's default, but a URL matching no route at all is
  // resolved against the root route's own option — the default only covers a
  // notFound() thrown from somewhere deeper.
  notFoundComponent: RouteNotFound,
})

function AppShell() {
  return (
    <RouteFocusProvider>
      <Shell />
    </RouteFocusProvider>
  )
}

// Below the provider, because the content element is what the route focus hook
// hands its ref to.
function Shell() {
  const content = useRouteFocus<HTMLElement>()

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader skipTo={`#${MAIN_CONTENT_ID}`}>
        <MainNav />
        <LiveConnectionIndicator className="ms-auto" />
      </AppHeader>

      <main id={MAIN_CONTENT_ID} ref={content} tabIndex={-1} className="flex-1">
        <Page>
          <Outlet />
        </Page>
      </main>

      <Suspense>
        <RouterDevtools position="bottom-right" />
        <QueryDevtools buttonPosition="bottom-left" />
      </Suspense>
    </div>
  )
}
