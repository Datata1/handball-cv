import type { TeamPhase } from '@/shared/api'

/**
 * The possession phase covering `time`, or `null` between two of them.
 *
 * Binary search rather than a scan: this runs against the playhead, and the
 * legacy version did a linear `find()` over every phase on every `timeupdate`.
 * `/team-phases` orders by start frame, which is what makes it possible.
 */
export function phaseAt(phases: readonly TeamPhase[], time: number): TeamPhase | null {
  let low = 0
  let high = phases.length - 1
  let candidate: TeamPhase | null = null

  while (low <= high) {
    const middle = (low + high) >> 1
    const phase = phases[middle]
    if (phase === undefined) break

    if (phase.start_time_s <= time) {
      candidate = phase
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  // Phases do not tile the match: the last one that started may already have
  // ended, and the gap is the transition the badge names.
  return candidate !== null && time < candidate.end_time_s ? candidate : null
}
