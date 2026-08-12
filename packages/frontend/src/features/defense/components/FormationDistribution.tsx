import { Shield } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { TeamName } from '@/features/report/teams'
import type { BackendLabel } from '@/i18n/backend-label'
import { ApiError, type FormationSummary } from '@/shared/api'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui'

import { formationTable, hasFormations } from '../formations'
import { TeamFormationList } from './TeamFormationList'

/**
 * Both teams' formation distributions, and the four ways there can be none.
 *
 * `/formation-summary` 404s with "Run wels-score first" for a match nothing has
 * scored yet. That is a fact about the data rather than a failure, so it becomes
 * an empty state — except while the read freeze is on, where a 404 says nothing
 * at all and `ErrorState` is the honest answer.
 */
export function FormationDistribution({
  summary,
  error,
  frozen = false,
  onRetry,
  teamName,
  label,
  selected,
  onSelect,
}: {
  summary: FormationSummary[] | undefined
  error?: unknown
  frozen?: boolean
  onRetry?: () => void
  teamName: TeamName
  label: BackendLabel
  /** The drill-in, straight off the URL. */
  selected: { team?: string; formation?: string }
  onSelect: (team: string, formation: string) => void
}) {
  const { t } = useTranslation('defense')

  const teams = useMemo(() => formationTable(summary ?? []), [summary])

  if (error !== undefined && error !== null) {
    const unscored = !frozen && error instanceof ApiError && error.status === 404

    return unscored ? (
      <Nothing />
    ) : (
      <ErrorState error={error} processing={frozen} onRetry={onRetry} />
    )
  }

  if (summary === undefined) return <LoadingState lines={5} label={t('loading')} />

  // Every label the classifier wrote may have been a phase label, which leaves
  // teams standing with no row in them.
  if (!hasFormations(teams)) return <Nothing />

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('formation.hint')}</p>

      {teams.map((team) => (
        <TeamFormationList
          key={team.team}
          team={team}
          teamName={teamName}
          label={label}
          selected={selected.team === team.team ? selected.formation : undefined}
          onSelect={(formation) => onSelect(team.team, formation)}
        />
      ))}
    </div>
  )
}

/**
 * Written for a trainer: the legacy copy told them to run `wels-score <id>`,
 * which is not a thing anyone can do from this screen.
 */
function Nothing() {
  const { t } = useTranslation('defense')

  return (
    <EmptyState
      icon={<Shield />}
      title={t('empty.title')}
      description={t('empty.description')}
    />
  )
}
