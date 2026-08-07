import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'

import i18n from '@/i18n'

/**
 * Every context the app needs, in one place. PRs 03–05 add the Query client and
 * the MobX root store here; tests and Storybook mount the same providers so a
 * story renders what the app renders.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
