/**
 * Who an item belongs to. Colour never carries the answer on its own — every
 * item's accessible name says whose it is — so this is emphasis, not meaning.
 */
export type TimelineTone = 'teamA' | 'teamB' | 'unknown' | 'event'

export type TimelineItem = {
  /** Unique across the whole timeline, not just its track. */
  id: string
  start: number
  /** Ignored on a `marker` track. */
  end?: number
  /** Names the item to a screen reader; the times are appended. */
  label: string
  /** Two or three characters drawn inside a bar wide enough to hold them. */
  short?: string
  tone?: TimelineTone
}

export type TimelineTrack = {
  id: string
  /** The row heading — "Tore", "Ballbesitz", "Spielzüge". */
  label: string
  kind: 'marker' | 'interval'
  items: readonly TimelineItem[]
}

/** What a click or Enter on an item hands back. */
export type TimelineSelection = {
  track: TimelineTrack
  item: TimelineItem
}
