import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

import { AppProviders } from '@/app/providers'
import logoIconUrl from '@/assets/logo-icon.webp'
import { LiveConnectionIndicator } from '@/shared/query'

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
  const { t } = useTranslation()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-wels-navy text-white">
        <nav
          aria-label={t('nav.main')}
          className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3"
        >
          <Link to="/" className="flex items-center">
            <img
              src={logoIconUrl}
              alt={t('nav.home')}
              width={32}
              height={32}
              className="size-8"
            />
          </Link>

          <LiveConnectionIndicator className="ms-auto" />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
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
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">{t('notFound.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('notFound.description')}</p>
      <Link to="/" className="mt-6 inline-block text-primary underline">
        {t('notFound.action')}
      </Link>
    </div>
  )
}
