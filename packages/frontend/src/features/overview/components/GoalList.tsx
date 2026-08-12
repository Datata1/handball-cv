import { useTranslation } from 'react-i18next'

import type { GoalEvent } from '@/shared/api'
import { formatClock } from '@/shared/video'

/**
 * Every goal the scoreboard reader saw, in the order it saw them. Picking one
 * moves the report's player to it, which is the only way to check a reading
 * against the video.
 *
 * The row shows the match clock when the OCR read one and the video position
 * otherwise, named either way — the two are different clocks, and a goal in the
 * 63rd minute of a recording that started late is not at 63:00 in the file.
 */
export function GoalList({
  goals,
  onSelect,
}: {
  goals: readonly GoalEvent[]
  onSelect: (goal: GoalEvent) => void
}) {
  const { t } = useTranslation('overview')

  if (goals.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('goals.empty')}</p>
  }

  return (
    <ul className="divide-y divide-border">
      {goals.map((goal) => {
        const team = t(goal.team === 'home' ? 'scoreboard.home' : 'scoreboard.away')
        const score = `${goal.score_home}:${goal.score_away}`
        const time = goal.game_time ?? formatClock(goal.timestamp_sec)

        return (
          <li key={`${goal.frame_number}-${score}`}>
            <button
              type="button"
              onClick={() => onSelect(goal)}
              // The three cells are separate elements, and a name computed from
              // them runs together as "02:18Heim1:0". Spelt out here instead,
              // including which clock the time is on.
              aria-label={t('goals.item', {
                clock: t(goal.game_time ? 'goals.gameTime' : 'goals.videoTime'),
                time,
                team,
                score,
              })}
              className="flex w-full items-baseline gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="w-14 shrink-0 tabular-nums text-muted-foreground">
                {time}
              </span>
              <span className="min-w-0 flex-1 truncate">{team}</span>
              <span className="shrink-0 font-semibold tabular-nums">{score}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
