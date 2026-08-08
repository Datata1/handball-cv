import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

const tab =
  '-mb-px inline-block border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground'

const activeTab = 'border-primary text-foreground'

/**
 * The report's section switcher: tabs to look at, links underneath, so back,
 * middle-click and "copy link address" all behave.
 */
export function SectionNav({ matchId }: { matchId: string }) {
  const { t } = useTranslation('report')

  const sections = [
    { to: '/matches/$matchId/overview', label: t('sections.overview') },
    { to: '/matches/$matchId/defense', label: t('sections.defense') },
    { to: '/matches/$matchId/offense', label: t('sections.offense') },
    { to: '/matches/$matchId/players', label: t('sections.players') },
    { to: '/matches/$matchId/heatmap', label: t('sections.heatmap') },
  ] as const

  return (
    <nav aria-label={t('nav.label')}>
      <ul className="flex gap-1 overflow-x-auto border-b border-border">
        {sections.map((section) => (
          <li key={section.to}>
            <Link
              to={section.to}
              params={{ matchId }}
              className={tab}
              activeProps={{ className: activeTab }}
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
