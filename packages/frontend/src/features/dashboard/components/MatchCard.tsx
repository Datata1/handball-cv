import { Link } from '@tanstack/react-router'
import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { type MatchMeta, matchThumbnailUrl } from '@/shared/api'

import { formatDate, matchTitle } from '../matches'
import type { MatchScore } from '../queries'
import { MatchThumbnail } from './MatchThumbnail'
import { StatusBadge } from './StatusBadge'

/**
 * One match in the grid.
 *
 * Only a `done` match is openable — everything else is still a card, with its
 * status and whatever the stub row does carry, rather than a dead link or a
 * gap in the grid.
 */
export function MatchCard({
  match,
  score,
  thumbnailSrc,
}: {
  match: MatchMeta
  score?: MatchScore | null
  /** Defaults to the backend's thumbnail endpoint; stories pass their own. */
  thumbnailSrc?: string
}) {
  const { t, i18n } = useTranslation('dashboard')

  const title = matchTitle(match)
  const openable = match.status === 'done'
  const ingestedAt = formatDate(match.ingested_at, i18n.language)

  return (
    <Card className="relative gap-0 overflow-hidden py-0 transition-shadow has-[a:hover]:shadow-md has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50">
      <MatchThumbnail
        src={openable ? (thumbnailSrc ?? matchThumbnailUrl(match.match_id)) : null}
      />

      <StatusBadge status={match.status} className="absolute end-3 top-3" />

      <div className="space-y-3 p-4">
        <h3 className="truncate font-medium">
          {openable ? (
            // Stretched over the whole card, so the card is the click target
            // while staying one link with one accessible name.
            <Link
              to="/matches/$matchId"
              params={{ matchId: match.match_id }}
              className="outline-none after:absolute after:inset-0 hover:underline"
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>

        <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <span className="truncate">
            {match.team_a_name?.trim() || t('card.teamA')}
          </span>
          <span className="shrink-0 text-xs">{t('card.versus')}</span>
          <span className="truncate">
            {match.team_b_name?.trim() || t('card.teamB')}
          </span>
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

        {openable ? (
          <p aria-hidden="true" className="text-sm font-medium text-primary">
            {t('card.open')} →
          </p>
        ) : null}
      </div>
    </Card>
  )
}
