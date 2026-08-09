import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { EmptyState } from '@/shared/ui'
import { usePlayer } from '@/stores'
import { isNavKey, moveCursor, type TimelineCursor } from './navigation'
import { Playhead } from './Playhead'
import { TimelineTrackRow } from './TimelineTrackRow'
import { formatClock } from './time'
import type { TimelineItem, TimelineSelection, TimelineTrack } from './types'

export type TimelineProps = {
  /** The match's length in seconds — the scale every item is placed against. */
  duration: number
  tracks: readonly TimelineTrack[]
  /** An item id. Ids are unique across tracks, not merely within one. */
  selectedId?: string | null
  /** `null` when the selected item is clicked again, which clears it. */
  onSelect?: (selection: TimelineSelection | null) => void
  className?: string
}

const NOWHERE: TimelineCursor = { track: 0, item: 0 }

/**
 * The match as layered interval tracks: goals as markers, possession, plays and
 * formations as bars, and one playhead across all of them.
 *
 * Selecting an item seeks the player, so the timeline is how a section says
 * "show me this scene". Everything is a real `<button>` and the arrow keys move
 * between them — left/right along a track, up/down to the nearest item in the
 * track above or below.
 *
 * There is no click-anywhere-to-clear background: a full-width click surface
 * with no accessible name is invisible to everyone not using a mouse. Clicking
 * the selected item again clears it, and so does Escape.
 */
export function Timeline({
  duration,
  tracks,
  selectedId = null,
  onSelect,
  className,
}: TimelineProps) {
  const { t } = useTranslation()
  const player = usePlayer()

  // Keyboard order has to follow the eye, and nothing guarantees a caller's
  // events arrive sorted.
  const rows = useMemo(
    () =>
      tracks.map((track) => ({
        ...track,
        items: [...track.items].sort((a, b) => a.start - b.start),
      })),
    [tracks],
  )

  const [cursor, setCursor] = useState<TimelineCursor>(NOWHERE)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  // Only a keypress moves focus; re-rendering with a new cursor must not steal
  // it from wherever the user actually is.
  const navigating = useRef(false)

  // A track list that changed under the cursor leaves it pointing at nothing.
  const at = rows[cursor.track]?.items[cursor.item] ? cursor : firstItem(rows)

  useEffect(() => {
    if (!navigating.current) return
    navigating.current = false

    buttons.current.get(cursorKey(cursor))?.focus()
  }, [cursor])

  function activate(track: TimelineTrack, item: TimelineItem) {
    player.seek(item.start)
    onSelect?.(item.id === selectedId ? null : { track, item })
  }

  function keyDown(event: KeyboardEvent, track: number, item: number) {
    if (event.key === 'Escape') {
      onSelect?.(null)
      return
    }

    if (!isNavKey(event.key)) return

    // Arrows and Home/End would otherwise scroll the report out from under the
    // user while they walk the timeline.
    event.preventDefault()
    navigating.current = true
    setCursor(moveCursor(rows, { track, item }, event.key))
  }

  const selected = rows
    .flatMap((track) => track.items)
    .find((item) => item.id === selectedId)

  if (rows.length === 0) {
    return <EmptyState title={t('states.empty')} description={t('timeline.empty')} />
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> groups form controls; a row of buttons is what `group` is for.
    <div
      role="group"
      aria-label={t('timeline.label')}
      className={cn('flex w-full gap-3', className)}
    >
      <div className="flex w-24 shrink-0 flex-col gap-1">
        {rows.map((track) => (
          <span
            key={track.id}
            aria-hidden="true"
            className="flex h-7 items-center truncate text-xs text-muted-foreground"
          >
            {track.label}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative flex flex-col gap-1">
          {rows.map((track, index) => (
            <TimelineTrackRow
              key={track.id}
              track={track}
              duration={duration}
              selectedId={selectedId}
              controls={{
                cursor: at.track === index ? at.item : null,
                activate,
                focus: (item) => setCursor({ track: index, item }),
                keyDown: (event, item) => keyDown(event, index, item),
                register: (item, node) => register(buttons.current, index, item, node),
              }}
            />
          ))}

          <Playhead duration={duration} />
        </div>

        <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground">
          <span>{formatClock(0)}</span>
          <span>{formatClock(duration)}</span>
        </div>
      </div>

      <p role="status" className="sr-only">
        {selected ? t('timeline.selected', { label: selected.label }) : ''}
      </p>
    </div>
  )
}

function cursorKey({ track, item }: TimelineCursor): string {
  return `${track}:${item}`
}

function firstItem(rows: readonly TimelineTrack[]): TimelineCursor {
  const track = rows.findIndex((row) => row.items.length > 0)

  return track === -1 ? NOWHERE : { track, item: 0 }
}

function register(
  buttons: Map<string, HTMLButtonElement>,
  track: number,
  item: number,
  node: HTMLButtonElement | null,
): void {
  const key = cursorKey({ track, item })

  if (node === null) buttons.delete(key)
  else buttons.set(key, node)
}
