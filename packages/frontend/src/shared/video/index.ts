// One player and one timeline, both driven by `PlayerStore`. Sections compose
// these rather than mounting a `<video>` of their own.

export { ClippedVideo, type ClippedVideoProps } from './ClippedVideo'
export { Timeline, type TimelineProps } from './Timeline'
export { formatClock } from './time'
export type {
  TimelineItem,
  TimelineSelection,
  TimelineTone,
  TimelineTrack,
} from './types'
