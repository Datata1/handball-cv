import { type RenderOptions, type RenderResult, render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

import { AppProviders } from '@/app/providers'

function Wrapper({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>
}

/**
 * render() with the app's providers. Composed stories already carry them via
 * setProjectAnnotations in setup.ts, so this is for the few things that are not
 * components — hooks under renderHook, and provider-level tests.
 */
export function renderWithI18n(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult {
  return render(ui, { wrapper: Wrapper, ...options })
}

export { Wrapper as ProviderWrapper }
