import { observer } from 'mobx-react-lite'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { usePlayer } from '@/stores'

import { timeOffset } from './geometry'
import { formatClock } from './time'

/** Seconds a key moves the playhead. Shift is the fine step. */
const STEP = { coarse: 30, normal: 5, fine: 1 } as const

/**
 * Where the video is, drawn across every track.
 *
 * The only observer in the timeline: it re-renders on each frame while the
 * tracks around it, which depend on nothing that playback changes, do not.
 *
 * It is a keyboard control rather than a pointer one — dragging is what the
 * video's own scrub bar is for — so it takes no pointer events and never
 * shadows the interval underneath it.
 */
export const Playhead = observer(function Playhead({ duration }: { duration: number }) {
  const { t } = useTranslation()
  const player = usePlayer()

  const time = player.currentTime

  function onKeyDown(event: KeyboardEvent) {
    const step = event.shiftKey ? STEP.fine : STEP.normal

    const targets: Record<string, number> = {
      ArrowLeft: time - step,
      ArrowRight: time + step,
      PageDown: time - STEP.coarse,
      PageUp: time + STEP.coarse,
      Home: 0,
      End: duration,
    }

    const target = targets[event.key]

    if (target === undefined) return

    event.preventDefault()
    // The store clamps into the clip, so a scrub cannot leave a scene.
    player.seek(target)
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={t('timeline.playhead')}
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={time}
      aria-valuetext={formatClock(time)}
      onKeyDown={onKeyDown}
      style={{ insetInlineStart: `${timeOffset(time, duration)}%` }}
      className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    />
  )
})
