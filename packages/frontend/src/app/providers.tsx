import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { I18nextProvider } from 'react-i18next'

import i18n from '@/i18n'
import { createQueryClient, StatusStreamContext, useStatusStream } from '@/shared/query'

/**
 * Every context the app needs, in one place. PR 05 adds the MobX root store
 * here; tests and Storybook mount the same providers so a story renders what
 * the app renders.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // One client per mount rather than a module singleton: the app mounts this
  // once, and every story and test gets a cache nobody else has written to.
  const [queryClient] = useState(createQueryClient)

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <StatusStream>{children}</StatusStream>
      </QueryClientProvider>
    </I18nextProvider>
  )
}

/**
 * Holds the app's single `EventSource`. Separate from `AppProviders` only
 * because the hook has to run below `QueryClientProvider` — it invalidates the
 * cache the provider above it owns.
 */
function StatusStream({ children }: { children: ReactNode }) {
  return <StatusStreamContext value={useStatusStream()}>{children}</StatusStreamContext>
}
