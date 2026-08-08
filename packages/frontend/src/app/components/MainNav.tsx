import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

const link =
  'rounded-md px-3 py-1.5 text-sm font-medium text-chrome-foreground/75 transition-colors hover:text-chrome-foreground'

const active = 'bg-chrome-foreground/15 text-chrome-foreground'

/** The top-level nav, mounted in `AppHeader`'s slot by `__root.tsx`. */
export function MainNav() {
  const { t } = useTranslation()

  return (
    <ul className="flex items-center gap-1">
      <li>
        {/* Without `exact`, "/" would match every URL in the app. */}
        <Link
          to="/"
          activeOptions={{ exact: true }}
          className={link}
          activeProps={{ className: active }}
        >
          {t('nav.dashboard')}
        </Link>
      </li>
      <li>
        <Link to="/upload" className={link} activeProps={{ className: active }}>
          {t('nav.upload')}
        </Link>
      </li>
    </ul>
  )
}
