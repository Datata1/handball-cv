import { useTranslation } from 'react-i18next'

import type { MatchMeta } from '@/shared/api'
import {
  formatMatchDate,
  type MatchNameField,
  type MatchRename,
} from '@/shared/matches'
import { EditableField, PageHeader } from '@/shared/ui'

/**
 * The match, named. The same three fields the dashboard card offers, because
 * the report is where a trainer notices that the teams are the wrong way round.
 */
export function ReportHeader({
  match,
  rename,
}: {
  match: MatchMeta
  rename: MatchRename
}) {
  const { t, i18n } = useTranslation('report')

  const saving = rename.saving?.matchId === match.match_id ? rename.saving.field : null
  const failed = rename.failed?.matchId === match.match_id ? rename.failed.field : null
  const recordedAt = formatMatchDate(match.date, i18n.language)

  function nameField(field: MatchNameField) {
    return {
      value: match[field] ?? '',
      pending: saving === field,
      error: failed === field ? t('header.renameError') : undefined,
      onSave: (next: string) => rename.rename(match.match_id, field, next),
      className: 'max-w-full',
    }
  }

  return (
    <PageHeader
      title={
        <EditableField
          {...nameField('display_name')}
          label={t('header.nameLabel')}
          // The report is reached by file name when nothing else is set, so the
          // editor opens on that rather than on "Nicht gesetzt".
          placeholder={match.file_name || match.match_id}
        />
      }
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <EditableField
            {...nameField('team_a_name')}
            label={t('header.teamALabel')}
            placeholder={t('header.teamA')}
          />
          <span className="text-xs">{t('header.versus')}</span>
          <EditableField
            {...nameField('team_b_name')}
            label={t('header.teamBLabel')}
            placeholder={t('header.teamB')}
          />

          {recordedAt || match.duration ? (
            <span className="inline-flex items-center gap-2 text-xs">
              <span aria-hidden="true">·</span>

              {recordedAt ? (
                <span>
                  <span className="sr-only">{t('header.recordedAt')} </span>
                  {recordedAt}
                </span>
              ) : null}

              {match.duration ? (
                <span className="tabular-nums">
                  <span className="sr-only">{t('header.duration')} </span>
                  {match.duration}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      }
    />
  )
}
