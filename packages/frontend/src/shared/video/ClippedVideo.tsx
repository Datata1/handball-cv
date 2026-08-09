import { reaction } from 'mobx'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { bindVideoClock, type Interval, usePlayer } from '@/stores'

import { formatClock } from './time'

export type ClippedVideoProps = {
  src: string
  /** Confines playback to `[start, end)`. `null` plays the whole match. */
  clip?: Interval | null
  /** Scenes loop so a move can be watched twice; the full match does not. */
  autoLoop?: boolean
  /** The player's accessible name — "Annotiertes Video", say. */
  label?: string
  className?: string
}

/**
 * The one video player in the app.
 *
 * The element owns the clock and `PlayerStore` mirrors it: time and transport
 * flow element → store through `bindVideoClock`, and the store's `pendingSeek`
 * and `playing` flow back the other way. Nothing else writes `currentTime`.
 *
 * Clip enforcement therefore lives in the store, on the frame callback rather
 * than on `timeupdate` — which fires at ~4Hz and used to overshoot a clip end
 * by up to a quarter of a second. One consequence of the store owning it: while
 * a clip is set, scrubbing the native controls past its end snaps back to the
 * start. A section that wants free scrubbing passes no clip.
 */
export function ClippedVideo({
  src,
  clip = null,
  autoLoop = false,
  label,
  className,
}: ClippedVideoProps) {
  const { t } = useTranslation()
  const player = usePlayer()
  const video = useRef<HTMLVideoElement>(null)

  const start = clip?.start ?? null
  const end = clip?.end ?? null

  // The reactions below are created once per element, so what they read of the
  // current props has to reach them through a ref.
  const current = useRef({ autoLoop, start })
  current.current = { autoLoop, start }

  useEffect(() => {
    if (start === null || end === null) {
      player.clearClip()
      return
    }

    player.setClip({ start, end })

    return () => player.clearClip()
  }, [player, start, end])

  useEffect(() => {
    const element = video.current
    if (element === null) return

    const unbindClock = bindVideoClock(element, player)

    // `clip` travels with the seek so the effect never reads an observable
    // outside a derivation — which strict mode reports as a wiring bug.
    const applySeek = reaction(
      () => ({ target: player.pendingSeek, clip: player.clip }),
      ({ target, clip: active }) => {
        if (target === null) return

        // A rewind issued because the clip ran out: the element is still sat at
        // the end, and a looping clip carries straight on from the start.
        const wrapped = active !== null && element.currentTime >= active.end

        element.currentTime = target
        player.clearSeek()

        // Re-arming the store rather than the element, so the transport
        // reaction below sees `playing` unchanged and leaves the loop alone.
        if (wrapped && current.current.autoLoop) player.play()
      },
      { fireImmediately: true },
    )

    const applyTransport = reaction(
      () => player.playing,
      (playing) => {
        if (playing === !element.paused) return

        if (playing) resume(element)
        else element.pause()
      },
    )

    // Setting `currentTime` before metadata arrives only records a default
    // start position, and a source swap resets the element to zero.
    const toClipStart = () => {
      const from = current.current.start
      if (from !== null) element.currentTime = from
    }

    element.addEventListener('loadedmetadata', toClipStart)

    return () => {
      element.removeEventListener('loadedmetadata', toClipStart)
      applySeek()
      applyTransport()
      unbindClock()
    }
  }, [player])

  return (
    <figure className={cn('space-y-1', className)}>
      <div className="overflow-hidden rounded-lg bg-wels-dark">
        {/* biome-ignore lint/a11y/useMediaCaption: a match recording carries no
            speech to caption; WCAG 1.2.2 covers synchronised audio. */}
        <video
          ref={video}
          src={src}
          controls
          preload="metadata"
          aria-label={label ?? t('video.label')}
          className="block max-h-[70vh] w-full"
        >
          {t('video.unsupported')}
        </video>
      </div>

      {clip ? (
        <figcaption className="text-xs tabular-nums text-muted-foreground">
          {t('video.clip', {
            start: formatClock(clip.start),
            end: formatClock(clip.end),
          })}
        </figcaption>
      ) : null}
    </figure>
  )
}

/** A blocked autoplay rejects, and jsdom returns nothing at all. */
function resume(element: HTMLVideoElement): void {
  const started: Promise<void> | undefined = element.play()
  started?.catch(() => {})
}
