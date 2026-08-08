import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppProviders } from './app/providers'
import { createAppRouter } from './app/router'
import './styles/index.css'

const router = createAppRouter()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('#root is missing from index.html')
}

// The providers sit *above* the router, not inside `__root`'s component: a
// route's error boundary wraps its component from the outside, so a boundary
// mounted below the providers could not call t() or read the query cache.
createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
