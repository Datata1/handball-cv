/**
 * A position in the match as `mm:ss`, counting minutes past 60 rather than
 * rolling into hours — a handball match is read as "72:13", not "1:12:13".
 */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const minutes = Math.floor(total / 60)
  const rest = total % 60

  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}
