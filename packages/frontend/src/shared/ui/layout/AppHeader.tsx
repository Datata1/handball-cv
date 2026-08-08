import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import logoIconUrl from '@/assets/logo-icon.webp'
import { cn } from '@/lib/utils'

/**
 * The application bar. `children` is the nav slot — links, the connection
 * indicator, anything that belongs beside the mark.
 */
export function AppHeader({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <header className={cn('bg-chrome text-chrome-foreground', className)}>
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
