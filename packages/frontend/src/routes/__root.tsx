import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

import logoUrl from '@/assets/logo.webp'

// Devtools are dev-only: in a production build this resolves to a component
// that renders nothing, so the package never reaches the bundle.
const RouterDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import('@tanstack/react-router-devtools').then((mod) => ({
        default: mod.TanStackRouterDevtools,
      })),
    )

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-wels-navy text-white">
        <nav
          aria-label="Hauptnavigation"
          className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3"
        >
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            {/* The asset is 1024x559 (1.83:1). `size-7` forced it into a square
                and squashed it — constrain the height and let width follow.
                width/height match the intrinsic ratio to reserve layout space. */}
            <img src={logoUrl} alt="" width={51} height={28} className="h-7 w-auto" />
            WELS
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <Suspense>
        <RouterDevtools position="bottom-right" />
      </Suspense>
    </div>
  )
}

function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Seite nicht gefunden</h1>
      <p className="mt-2 text-muted-foreground">
        Diese Adresse gehört zu keiner Ansicht.
      </p>
      <Link to="/" className="mt-6 inline-block text-primary underline">
        Zur Übersicht
      </Link>
    </div>
  )
}
