import { Link } from '@tanstack/react-router'
import { Inbox, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { MatchMeta } from '@/shared/api'
import { EmptyState, ErrorState } from '@/shared/ui'

import type { MatchScores } from '../queries'
import { MatchCard } from './MatchCard'

const grid = 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3'

const SKELETONS = ['a', 'b', 'c']

/**
 * The grid and the three ways it can have no cards in it.
 *
 * `matches === undefined` is the first load only: a background refetch keeps
 * the previous list on screen, so an SSE round does not flash a skeleton over
 * a list that is already right.
 */
export function MatchList({
  matches,
  scores,
  error,
  searching = false,
  onRetry,
}: {
  matches: readonly MatchMeta[] | undefined
  scores?: MatchScores
  error?: unknown
  /** Picks the empty copy: nothing ingested yet, or nothing matching the search. */
  searching?: boolean
  onRetry?: () => void
}) {
  const { t } = useTranslation('dashboard')

  if (error !== undefined && error !== null) {
    return <ErrorState error={error} onRetry={onRetry} />
  }

  if (matches === undefined) {
    return (
      <div role="status" aria-busy="true" className={grid}>
        <span className="sr-only">{t('list.loading')}</span>

        {SKELETONS.map((id) => (
          <div key={id} className="overflow-hidden rounded-xl border">
            <Skeleton className="aspect-video rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (matches.length === 0) {
    return searching ? (
      <EmptyState
        icon={<SearchX />}
        title={t('noResults.title')}
        description={t('noResults.description')}
      />
    ) : (
      <EmptyState
        icon={<Inbox />}
        title={t('empty.title')}
        description={t('empty.description')}
        action={
          <Button asChild>
            <Link to="/upload">{t('empty.action')}</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className={grid}>
      {matches.map((match) => (
        <MatchCard
          key={match.match_id}
          match={match}
          score={scores?.get(match.match_id)}
        />
      ))}
    </div>
  )
}
