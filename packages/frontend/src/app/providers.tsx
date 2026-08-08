import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { I18nextProvider } from 'react-i18next'

import i18n from '@/i18n'
import { createQueryClient, StatusStreamContext, useStatusStream } from '@/shared/query'
import { StoreProvider } from '@/stores'

/** Every context the app mounts. Storybook and the tests mount the same set. */
export function AppProviders({ children }: { children: ReactNode }) {
  // Per mount rather than a module singleton, so stories and tests never share
  // a cache.
  const [queryClient] = useState(createQueryClient)

  return (
    <I18nextProvider i18n={i18n}>
      <StoreProvider>
        <QueryClientProvider client={queryClient}>
          <StatusStream>{children}</StatusStream>
        </QueryClientProvider>
      </StoreProvider>
    </I18nextProvider>
  )
}

// Its own component because the stream hook invalidates the cache, so it has to
// run below QueryClientProvider.
function StatusStream({ children }: { children: ReactNode }) {
  return <StatusStreamContext value={useStatusStream()}>{children}</StatusStreamContext>
}
