import { Film } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { TeamName } from '@/features/report/teams'
import type { BackendLabel } from '@/i18n/backend-label'
import type { PlayEvent } from '@/shared/api'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui'
import { formatClock } from '@/shared/video'

import { playDuration, playOutcome } from '../plays'

/**
 * The detected runs of one play type, as things to watch.
 *
 * Selecting one drives the report's single player and its timeline — there is
 * no video in here. The legacy accordion mounted a `ScenePlayer` per expanded
 * row, so a match could end up with several videos decoding at once.
 */
export function PlaySceneList({
  plays,
  error,
  frozen = false,
  onRetry,
  teamName,
  label,
  selectedId,
  onSelect,
}: {
  plays: PlayEvent[] | undefined
  error?: unknown
  frozen?: boolean
  onRetry?: () => void
  teamName: TeamName
  label: BackendLabel
  /** `event_id` of the play the player is clipped to. */
  selectedId: number | null
  /** `null` when the selected play is picked again, which releases the clip. */
  onSelect: (play: PlayEvent | null) => void
}) {
  const { t } = useTranslation('offense')
  const { t: tCommon } = useTranslation()

  if (error !== undefined && error !== null) {
    return <ErrorState error={error} processing={frozen} onRetry={onRetry} />
  }

  if (plays === undefined) return <LoadingState lines={4} label={t('loading')} />

  if (plays.length === 0) {
    return frozen ? (
      <EmptyState
        title={t('frozen.title')}
        description={tCommon('errors.processing')}
      />
    ) : (
      <EmptyState
        icon={<Film />}
        title={t('scenes.empty.title')}
        description={t('scenes.empty.description')}
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('scenes.hint')}</p>

      <ul className="space-y-2">
        {plays.map((play, index) => {
          const selected = play.event_id === selectedId
          const outcome = playOutcome(play)

          return (
            <li key={play.event_id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : play)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-muted"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground tabular-nums">
                  {index + 1}
                </span>

                <span className="min-w-0 flex-1 truncate font-medium tabular-nums">
                  {t('scenes.window', {
                    start: formatClock(play.start_time_s),
                    end: formatClock(play.end_time_s),
                  })}
                </span>

                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {tCommon('units.seconds', { value: Math.round(playDuration(play)) })}
                </span>

                <span className="shrink-0 text-sm text-muted-foreground">
                  {teamName(play.team)}
                </span>

                {/* An outcome of `null` is the two indistinguishable cases the
                    endpoint has: no attack was linked, or the database predates
                    attack sequences. Neither of them is "kein Tor". */}
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {outcome === null
                    ? t('scenes.outcomeUnknown')
                    : label('outcome', outcome)}
                </span>

                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {t('scenes.confidence', {
                    percent: Math.round(play.confidence * 100),
                  })}
                </span>

                {/* Read-only: the label loop is deferred, so nothing here writes
                    a verdict — but a verdict already stored is still true. */}
                {play.label === null ? null : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t('scenes.verdict', { verdict: label('verdict', play.label) })}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <p className="text-sm text-muted-foreground">
        {t('scenes.caption', { count: plays.length })}
      </p>
    </div>
  )
}
