import { useTranslation } from 'react-i18next'

import type { TeamName } from '@/features/report/teams'
import type { BackendLabel } from '@/i18n/backend-label'
import { cn } from '@/lib/utils'
import { Bar, Section } from '@/shared/ui'

import type { TeamFormations } from '../formations'

/**
 * One team's defensive shapes, most-used first, each a way into its scenes.
 *
 * Every label here comes from the response — `label('formation', …)` translates
 * the ones we happen to have German copy for and hands back the rest unchanged,
 * so a formation the classifier learns next appears under its own name instead
 * of vanishing.
 */
export function TeamFormationList({
  team,
  teamName,
  label,
  selected,
  onSelect,
}: {
  team: TeamFormations
  teamName: TeamName
  label: BackendLabel
  /** The formation drilled into, if it is one of this team's. */
  selected: string | undefined
  onSelect: (formation: string) => void
}) {
  const { t } = useTranslation('defense')

  if (team.rows.length === 0) {
    return (
      <Section headingLevel={3} title={teamName(team.team)}>
        <p className="text-sm text-muted-foreground">{t('team.none')}</p>
      </Section>
    )
  }

  return (
    <Section
      headingLevel={3}
      title={teamName(team.team)}
      description={t('team.frames', { count: team.total })}
    >
      <ul className="space-y-2">
        {team.rows.map((row) => (
          <li key={row.formation}>
            <button
              type="button"
              aria-pressed={row.formation === selected}
              onClick={() => onSelect(row.formation)}
              className={cn(
                'w-full rounded-lg border border-border px-3 py-2 text-left transition-colors',
                'hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                'aria-pressed:border-primary aria-pressed:bg-muted',
              )}
            >
              <Bar
                label={
                  <span className="flex items-baseline gap-2">
                    <span className="truncate font-medium text-foreground">
                      {label('formation', row.formation)}
                    </span>
                    {row.dominant ? (
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                        {t('formation.dominant')}
                      </span>
                    ) : null}
                  </span>
                }
                value={row.share}
                valueLabel={t('formation.value', {
                  percent: Math.round(row.share * 100),
                  frames: row.count,
                })}
              />
            </button>
          </li>
        ))}
      </ul>
    </Section>
  )
}
