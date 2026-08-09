/**
 * Where the roving tabindex sits: exactly one item in the whole timeline is
 * tabbable, and the arrow keys move it.
 */
export type TimelineCursor = { track: number; item: number }

const NAV_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
] as const

export type TimelineNavKey = (typeof NAV_KEYS)[number]

export function isNavKey(key: string): key is TimelineNavKey {
  return (NAV_KEYS as readonly string[]).includes(key)
}

/** Only the item's position matters here, so navigation stays testable. */
type NavTrack = { items: readonly { start: number }[] }

/** The first track at or after `from` that has anything to focus. */
function nextPopulated(
  tracks: readonly NavTrack[],
  from: number,
  step: 1 | -1,
): number | null {
  for (let index = from; index >= 0 && index < tracks.length; index += step) {
    if (tracks[index].items.length > 0) return index
  }

  return null
}

/** The item nearest in time, which is what "the row above" means visually. */
function closestItem(track: NavTrack, time: number): number {
  let best = 0

  for (let index = 1; index < track.items.length; index += 1) {
    const distance = Math.abs(track.items[index].start - time)
    if (distance < Math.abs(track.items[best].start - time)) best = index
  }

  return best
}

/**
 * The cursor a navigation key moves to. Movement clamps rather than wraps —
 * arrowing off the end of a track is how a keyboard user learns where the
 * match ends — and tracks with no items are skipped rather than trapping focus
 * on an empty row.
 *
 * Items are expected in ascending start order, so keyboard order matches what
 * the eye follows.
 */
export function moveCursor(
  tracks: readonly NavTrack[],
  cursor: TimelineCursor,
  key: TimelineNavKey,
): TimelineCursor {
  const track = tracks[cursor.track]
  if (track === undefined || track.items.length === 0) return cursor

  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const step = key === 'ArrowRight' ? 1 : -1
    const item = Math.min(Math.max(cursor.item + step, 0), track.items.length - 1)
    return { track: cursor.track, item }
  }

  if (key === 'Home') return { track: cursor.track, item: 0 }
  if (key === 'End') return { track: cursor.track, item: track.items.length - 1 }

  const step = key === 'ArrowDown' ? 1 : -1
  const next = nextPopulated(tracks, cursor.track + step, step)
  if (next === null) return cursor

  const time = track.items[cursor.item]?.start ?? 0
  return { track: next, item: closestItem(tracks[next], time) }
}
