import { useRouterState } from '@tanstack/react-router'
import {
  createContext,
  type ReactNode,
  type RefObject,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { viewName } from '../focus'

type RouteFocus = {
  /** `false` once a target deeper in the tree has taken this navigation. */
  claim: (pathname: string) => boolean
  announce: (view: string) => void
}

const RouteFocusContext = createContext<RouteFocus | null>(null)

/**
 * Where focus goes on a navigation, and the region that says where it went.
 *
 * The router moves neither: a keyboard user changing view keeps focus on a link
 * that the new page may not even have, and a screen reader is told nothing at
 * all. `useRouteFocus` marks the element a navigation should land on.
 */
export function RouteFocusProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState('')
  const taken = useRef<string | null>(null)

  const value = useMemo<RouteFocus>(
    () => ({
      claim: (pathname) => {
        if (taken.current === pathname) return false

        taken.current = pathname
        return true
      },
      announce: setView,
    }),
    [],
  )

  return (
    <RouteFocusContext value={value}>
      {children}

      {/* Mounted empty and filled from an effect: a live region that arrives
          with its text already in it is not announced. */}
      <p role="status" className="sr-only">
        {view}
      </p>
    </RouteFocusContext>
  )
}

/**
 * A ref for the element a navigation should focus — `<main>` for a route
 * change, and the section wrapper inside the report shell, which stays mounted
 * across a section change and so claims those before `<main>` sees them.
 *
 * The first render is never a navigation: opening a URL directly leaves focus
 * at the top of the document, where the browser put it.
 */
export function useRouteFocus<T extends HTMLElement>(): RefObject<T | null> {
  const context = use(RouteFocusContext)
  const target = useRef<T>(null)
  const { pathname, ready } = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      ready: state.status === 'idle',
    }),
  })

  const seen = useRef(pathname)
  const unannounced = useRef(false)

  useEffect(() => {
    if (context === null) {
      throw new Error('useRouteFocus() was called outside a RouteFocusProvider')
    }

    const element = target.current

    if (pathname !== seen.current) {
      seen.current = pathname

      // Effects run child-first, so an inner target has already claimed the
      // navigation by the time an outer one asks.
      unannounced.current = context.claim(pathname)

      if (unannounced.current) element?.focus()
    }

    // Route modules are code-split, so the new view is still a chunk in flight
    // when the location changes. Focus can move to the container regardless —
    // it is the same element either way — but naming it has to wait for the
    // heading to exist.
    if (unannounced.current && ready && element !== null) {
      unannounced.current = false
      context.announce(viewName(element))
    }
  }, [pathname, ready, context])

  return target
}
