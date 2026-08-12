import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import logoIconUrl from '@/assets/logo-icon.webp'
import { cn } from '@/lib/utils'

/**
 * The application bar. `children` is the nav slot — links, the connection
 * indicator, anything that belongs beside the mark.
 *
 * `skipTo` puts a skip link ahead of everything else in the tab order, so the
 * nav is not something a keyboard user tabs through on every view.
 */
export function AppHeader({
  children,
  skipTo,
  className,
}: {
  children?: ReactNode
  /** Fragment of the content element, `#main-content`. */
  skipTo?: string
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <header className={cn('relative bg-chrome text-chrome-foreground', className)}>
      {skipTo ? (
        <a
          href={skipTo}
          className="sr-only rounded-md bg-background px-3 py-2 font-medium text-foreground text-sm focus:not-sr-only focus:absolute focus:start-4 focus:top-2 focus:z-50 focus:outline-2 focus:outline-ring focus:outline-offset-2"
        >
          {t('nav.skip')}
        </a>
      ) : null}

      <nav
        aria-label={t('nav.main')}
        className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3"
      >
        <Link to="/" className="flex items-center rounded-md">
          <img
            src={logoIconUrl}
            alt={t('nav.home')}
            width={32}
            height={32}
            className="size-8"
          />
        </Link>

        {children}
      </nav>
    </header>
  )
}
