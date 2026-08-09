import { Link } from '@tanstack/react-router'
import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { type MatchMeta, matchThumbnailUrl } from '@/shared/api'
import { formatMatchDate } from '@/shared/matches'
import { EditableField, InlineError } from '@/shared/ui'

import { matchTitle } from '../matches'
import type { MatchMutations, MatchNameField, MatchScore } from '../queries'
import { DeleteMatchDialog } from './DeleteMatchDialog'
import { MatchThumbnail } from './MatchThumbnail'
import { StatusBadge } from './StatusBadge'

/**
 * One match in the grid: what was measured, the three names a trainer can
 * correct, and the way out of the list.
 *
 * Only a `done` match is openable — everything else is still a card, with its
 * status and whatever the stub row does carry, rather than a dead link or a
 * gap in the grid. The names stay editable in every status: they live in a meta
 * file the ingestion never touches.
 */
export function MatchCard({
  match,
  score,
  mutations,
  thumbnailSrc,
}: {
  match: MatchMeta
  score?: MatchScore | null
  mutations: MatchMutations
  /** Defaults to the backend's thumbnail endpoint; stories pass their own. */
  thumbnailSrc?: string
}) {
  const { t, i18n } = useTranslation('dashboard')

  const title = matchTitle(match)
  const openable = match.status === 'done'
  const ingestedAt = formatMatchDate(match.ingested_at, i18n.language)

  const saving =
    mutations.saving?.matchId === match.match_id ? mutations.saving.field : null
  const failed =
    mutations.renameFailed?.matchId === match.match_id
      ? mutations.renameFailed.field
      : null
  const deleteFailed =
    mutations.deleteFailed?.matchId === match.match_id ? mutations.deleteFailed : null

  function nameField(field: MatchNameField) {
    return {
      value: match[field] ?? '',
      pending: saving === field,
      error: failed === field ? t('rename.error') : undefined,
      onSave: (next: string) => mutations.rename(match.match_id, field, next),
      // Above the stretched link below, which otherwise covers the whole card.
      className: 'relative z-10 max-w-full',
    }
  }

  return (
    <Card className="relative gap-0 overflow-hidden py-0 transition-shadow has-[a:hover]:shadow-md has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50">
      <MatchThumbnail
        src={openable ? (thumbnailSrc ?? matchThumbnailUrl(match.match_id)) : null}
      />

      <StatusBadge status={match.status} className="absolute end-3 top-3" />

      <div className="space-y-3 p-4">
        <h3 className="font-medium">
          <EditableField
            {...nameField('display_name')}
            label={t('card.nameLabel')}
            // The title falls back to the file name, so the editor shows the
            // same thing rather than "Nicht gesetzt".
            placeholder={match.file_name || match.match_id}
          />
        </h3>

        <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <EditableField
            {...nameField('team_a_name')}
            label={t('card.teamALabel')}
            placeholder={t('card.teamA')}
          />
          <span className="shrink-0 text-xs">{t('card.versus')}</span>
          <EditableField
            {...nameField('team_b_name')}
            label={t('card.teamBLabel')}
            placeholder={t('card.teamB')}
          />
        </p>

        {score ? (
          <p className="flex items-center justify-center gap-2 rounded-md bg-muted py-1.5 text-lg font-semibold tabular-nums">
            <span className="sr-only">{t('card.score')}</span>
            <span>{score.home}</span>
            <span aria-hidden="true" className="text-muted-foreground">
              {t('card.scoreSeparator')}
            </span>
            <span>{score.away}</span>
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {match.duration ? (
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden="true" className="size-3" />
              <span className="sr-only">{t('card.duration')}</span>
              {match.duration}
            </span>
          ) : (
            <span />
          )}

          {ingestedAt ? (
            <span>
              <span className="sr-only">{t('card.ingestedAt')}</span>
              {ingestedAt}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          {openable ? (
            // Stretched over the whole card, so the card is the click target
            // while staying one link with one accessible name.
            <Link
              to="/matches/$matchId"
              params={{ matchId: match.match_id }}
              aria-label={t('card.openMatch', { title })}
              className="text-sm font-medium text-primary outline-none after:absolute after:inset-0 hover:underline"
            >
              {t('card.open')}
              <span aria-hidden="true"> →</span>
            </Link>
          ) : (
            <span />
          )}

          <DeleteMatchDialog
            title={title}
            onConfirm={() => mutations.remove(match.match_id)}
            className="relative z-10"
          />
        </div>

        {deleteFailed ? (
          <InlineError>
            {t(deleteFailed.blocked ? 'delete.blocked' : 'delete.error')}
          </InlineError>
        ) : null}
      </div>
    </Card>
  )
}
