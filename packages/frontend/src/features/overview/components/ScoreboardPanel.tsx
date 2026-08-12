import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import type { GoalEvent, ScoreboardSummary } from '@/shared/api'
import { finalScore } from '@/shared/matches'
import { EmptyState, ErrorState, LoadingState, Section } from '@/shared/ui'

import { GoalList } from './GoalList'

/**
 * What the scoreboard reader made of the match: the final score, and the goals
 * that led to it.
 *
 * `summary === null` is the answer to a 404, which for this endpoint means the
 * match has no readings at all — a fact about the video, not a failure. The
 * final score is separately absent when no single reading carried both scores.
 */
export function ScoreboardPanel({
  summary,
  error,
  frozen = false,
  onRetry,
  onSelectGoal,
}: {
  summary: ScoreboardSummary | null | undefined
  error?: unknown
  /** A 404 while a match is being ingested says nothing; see `mayBeFrozen`. */
  frozen?: boolean
  onRetry?: () => void
  onSelectGoal: (goal: GoalEvent) => void
}) {
  const { t } = useTranslation('overview')

  if (error !== undefined && error !== null) {
    return <ErrorState error={error} processing={frozen} onRetry={onRetry} />
  }

  if (summary === undefined) return <LoadingState lines={3} />

  if (summary === null) {
    return (
      <EmptyState
        title={t('scoreboard.empty.title')}
        description={t('scoreboard.empty.description')}
      />
    )
  }

  const score = finalScore(summary)

  return (
    <div className="space-y-4">
      {score === null ? (
        <EmptyState
          title={t('scoreboard.noFinal.title')}
          description={t('scoreboard.noFinal.description')}
        />
      ) : (
        <Card className="items-center gap-2 px-6 py-6 text-center">
          <p className="text-sm text-muted-foreground">{t('scoreboard.final')}</p>

          <p className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1">
            <span className="text-sm font-medium">{t('scoreboard.home')}</span>
            <span className="text-4xl font-semibold tabular-nums tracking-tight">
              {`${score.home} : ${score.away}`}
            </span>
            <span className="text-sm font-medium">{t('scoreboard.away')}</span>
          </p>

          {summary.final_game_time ? (
            <p className="text-xs text-muted-foreground">
              {t('scoreboard.finalAt', { time: summary.final_game_time })}
            </p>
          ) : null}
        </Card>
      )}

      <Section headingLevel={3} title={t('goals.title')}>
        <GoalList goals={summary.goals} onSelect={onSelectGoal} />
      </Section>
    </div>
  )
}
