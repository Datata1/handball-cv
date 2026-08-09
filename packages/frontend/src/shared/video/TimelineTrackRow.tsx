import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { timeBar, timeOffset } from './geometry'
import { formatClock } from './time'
import type { TimelineItem, TimelineTone, TimelineTrack } from './types'

const TONES: Record<TimelineTone, string> = {
  teamA: 'bg-chart-1 text-white',
  teamB: 'bg-chart-2 text-white',
  unknown: 'bg-muted-foreground text-white',
  event: 'bg-chart-4 text-white',
}

/** Below this a bar has no room for its short label without clipping it. */
const LABEL_WIDTH_PERCENT = 4

export type TrackRowControls = {
  /** The one item in this track that is tabbable, if the cursor is here. */
  cursor: number | null
  activate: (track: TimelineTrack, item: TimelineItem) => void
  focus: (item: number) => void
  keyDown: (event: KeyboardEvent, item: number) => void
  register: (item: number, node: HTMLButtonElement | null) => void
}

/**
 * One lane of the timeline. Geometry is percent-based and depends only on the
 * items and the duration, so a row never re-renders as the playhead moves.
 */
export function TimelineTrackRow({
  track,
  duration,
  selectedId,
  controls,
}: {
  track: TimelineTrack
  duration: number
  selectedId: string | null
  controls: TrackRowControls
}) {
  const { t } = useTranslation()

  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> groups form controls; a row of buttons is what `group` is for.
    <div
      role="group"
      aria-label={track.label}
      className="relative h-7 w-full rounded-md bg-muted"
    >
      {track.items.map((item, index) => {
        const marker = track.kind === 'marker'
        const end = item.end ?? item.start
        const bar = marker ? null : timeBar(item.start, end, duration)
        const selected = item.id === selectedId

        return (
          <button
            key={item.id}
            ref={(node) => controls.register(index, node)}
            type="button"
            tabIndex={controls.cursor === index ? 0 : -1}
            aria-pressed={selected}
            aria-label={
              marker
                ? t('timeline.marker', {
                    label: item.label,
                    time: formatClock(item.start),
                  })
                : t('timeline.interval', {
                    label: item.label,
                    start: formatClock(item.start),
                    end: formatClock(end),
                  })
            }
            onClick={() => controls.activate(track, item)}
            onFocus={() => controls.focus(index)}
            onKeyDown={(event) => controls.keyDown(event, index)}
            style={
              bar
                ? { insetInlineStart: `${bar.left}%`, inlineSize: `${bar.width}%` }
                : { insetInlineStart: `${timeOffset(item.start, duration)}%` }
            }
            className={cn(
              'absolute inset-y-0.5 overflow-hidden rounded-sm transition-opacity',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
              TONES[item.tone ?? 'unknown'],
              // A marker has no duration to show, so it is a fixed-width tick
              // centred on its moment rather than a bar.
              marker && 'w-1.5 -translate-x-1/2 rounded-full',
              selected
                ? 'opacity-100 ring-2 ring-ring ring-offset-1 ring-offset-background'
                : 'opacity-60 hover:opacity-90',
            )}
          >
            {!marker && item.short && bar && bar.width >= LABEL_WIDTH_PERCENT ? (
              <span aria-hidden="true" className="px-1 text-[10px] font-semibold">
                {item.short}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
