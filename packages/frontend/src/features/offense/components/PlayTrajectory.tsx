import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type { PlayEvent } from '@/shared/api'
import { Court, type CourtData, CourtLayer, goalLineX, goalRect } from '@/shared/court'
import { formatClock } from '@/shared/video'

import { type PlayTrack, playTrajectories } from '../trajectories'

/**
 * Colours by position in the list, not by anything about the track: track ids
 * are not stable player identities, so a fixed colour per id would promise a
 * continuity the tracker does not have. `currentColor` carries the tone to the
 * stroke, the end dot and the legend swatch together.
 */
const TRACK_TONES = [
  'text-chart-1',
  'text-chart-2',
  'text-chart-3',
  'text-chart-4',
] as const

const STROKE_WIDTH_M = 0.3

/**
 * Where the players involved in one play ran, on the shared court.
 *
 * The court is drawn by `@/shared/court` and this contributes only the data
 * layer — the legacy app drew its own 40×20 court here, one of three separate
 * court implementations in three different coordinate systems.
 */
export function PlayTrajectory({
  play,
  playType,
  team,
}: {
  play: PlayEvent
  /** Resolved label of the play type, for the court's accessible name. */
  playType: string
  /** Resolved name of the attacking team. */
  team: string
}) {
  const { t } = useTranslation('offense')

  const trajectories = useMemo(() => playTrajectories(play.details), [play.details])

  const trackName = (track: PlayTrack) =>
    track.centroid
      ? t('trajectory.centroid')
      : t('trajectory.track', { id: track.trackId })

  if (trajectories === null) {
    return <p className="text-sm text-muted-foreground">{t('trajectory.none')}</p>
  }

  const { goal, tracks } = trajectories

  const data: CourtData = {
    label: t('trajectory.label', { playType, team }),
    layer: (
      <CourtLayer>
        {goal === null ? null : <rect {...goalRect(goal)} className="fill-chart-5" />}

        {tracks.map((track, index) => {
          const start = track.points[0]
          const end = track.points[track.points.length - 1]

          return (
            <g key={track.trackId} className={TRACK_TONES[index % TRACK_TONES.length]}>
              <polyline
                points={track.points.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH_M}
                strokeLinecap="round"
                strokeLinejoin="round"
                // The centroid is a mean over the team, so it is drawn as a
                // measurement rather than as somebody's run.
                strokeDasharray={track.centroid ? '0.8 0.5' : undefined}
              />
              <circle
                cx={start.x}
                cy={start.y}
                r={0.4}
                className="fill-background"
                stroke="currentColor"
                strokeWidth={0.2}
              />
              <circle cx={end.x} cy={end.y} r={0.5} fill="currentColor" />
            </g>
          )
        })}
      </CourtLayer>
    ),
    alternative: (
      <>
        <p>
          {t('trajectory.summary', {
            count: tracks.length,
            start: formatClock(play.start_time_s),
            end: formatClock(play.end_time_s),
          })}
        </p>
        <ul>
          {tracks.map((track) => (
            <li key={track.trackId}>
              {t('trajectory.path', {
                name: trackName(track),
                fromX: track.points[0].x,
                fromY: track.points[0].y,
                toX: track.points[track.points.length - 1].x,
                toY: track.points[track.points.length - 1].y,
              })}
            </li>
          ))}
        </ul>
        {goal === null ? null : (
          <p>{t('trajectory.attacked', { metres: goalLineX(goal) })}</p>
        )}
      </>
    ),
  }

  return (
    <div className="space-y-3">
      <Court data={data} className="mx-auto max-w-2xl" />

      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {tracks.map((track, index) => (
          <li
            key={track.trackId}
            className={cn(
              'flex items-center gap-1.5',
              TRACK_TONES[index % TRACK_TONES.length],
            )}
          >
            <span aria-hidden="true" className="h-1 w-4 rounded-full bg-current" />
            <span className="text-muted-foreground">{trackName(track)}</span>
          </li>
        ))}

        {goal === null ? null : (
          <li className="flex items-center gap-1.5 text-chart-5">
            <span aria-hidden="true" className="size-2 rounded-xs bg-current" />
            <span className="text-muted-foreground">{t('trajectory.goal')}</span>
          </li>
        )}
      </ul>

      <p className="text-center text-xs text-muted-foreground">
        {t('trajectory.hint')}
      </p>
    </div>
  )
}
