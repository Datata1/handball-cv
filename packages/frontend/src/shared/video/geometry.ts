/**
 * Where a timeline item sits, as percentages of the lane's width. Percent
 * rather than pixels so the geometry depends only on the items and the match
 * duration — never on the container — and can be memoized across playback.
 */
export type TimelineBar = { left: number; width: number }

/**
 * Floor on a bar's width. A two-second play inside a 90-minute match is 0.04%
 * wide: invisible, and too small to hit with a pointer.
 */
export const MIN_BAR_WIDTH_PERCENT = 0.8

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return Math.min(Math.max(percent, 0), 100)
}

/** A moment's offset along the lane. */
export function timeOffset(time: number, duration: number): number {
  if (!(duration > 0)) return 0

  return clampPercent((time / duration) * 100)
}

/** An interval's bar, widened to the floor and kept inside the lane. */
export function timeBar(start: number, end: number, duration: number): TimelineBar {
  if (!(duration > 0)) return { left: 0, width: MIN_BAR_WIDTH_PERCENT }

  const left = timeOffset(start, duration)
  const span = timeOffset(end, duration) - left
  const width = Math.min(Math.max(span, MIN_BAR_WIDTH_PERCENT), 100)

  // Widening a bar that ends with the match would otherwise push it past the
  // lane's right edge.
  return { left: Math.min(left, 100 - width), width }
}
