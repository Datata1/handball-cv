import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

import { AppProviders } from '@/app/providers'
import { Button } from '@/components/ui/button'
import { LiveConnectionIndicator } from '@/shared/query'
import { AppHeader, Page, PageHeader } from '@/shared/ui'

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
  component: RootLayout,
  notFoundComponent: NotFound,
})

// Providers wrap the shell rather than living inside it, so everything that
// calls t() — including notFoundComponent, rendered through the Outlet — is
// below them.
function RootLayout() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  )
}

function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader>
        <LiveConnectionIndicator className="ms-auto" />
      </AppHeader>

      <main className="flex-1">
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

function NotFound() {
  const { t } = useTranslation()

  return (
    <PageHeader
      title={t('notFound.title')}
      description={t('notFound.description')}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/">{t('notFound.action')}</Link>
        </Button>
      }
    />
  )
}
