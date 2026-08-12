import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import type { TeamName } from '@/features/report/teams'

/**
 * Narrows the table to one team bucket.
 *
 * The options are the buckets these rows actually contain, so a team the
 * classifier invents gets an entry and a match where it placed nobody does not
 * offer a filter that would empty the table.
 */
export function TeamFilter({
  teams,
  selected,
  onSelect,
  teamName,
}: {
  teams: readonly string[]
  selected: string | undefined
  onSelect: (team: string | undefined) => void
  teamName: TeamName
}) {
  const { t } = useTranslation('players')
  const selectId = useId()

  // A `?team=` no row carries still has to appear, or the select would fall back
  // to "all" while the table below it is filtered down to nothing.
  const options =
    selected !== undefined && !teams.includes(selected) ? [...teams, selected] : teams

  return (
    <div className="sm:w-64">
      <Label htmlFor={selectId} className="sr-only">
        {t('filter.team')}
      </Label>

      <NativeSelect
        id={selectId}
        value={selected ?? ''}
        onChange={(event) => onSelect(event.target.value || undefined)}
      >
        <option value="">{t('filter.all')}</option>
        {options.map((team) => (
          <option key={team} value={team}>
            {teamName(team)}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}
