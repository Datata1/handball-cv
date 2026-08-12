import type { HeatmapSearch } from '@/features/report/search'
import { phaseIdFromItem, phaseItemId } from '@/features/report/timeline'
import type { HeatmapPointsFilters } from '@/shared/api'

/**
 * The URL as the point-cloud request, and back.
 *
 * Every control this section has is a search param, so the filters object is a
 * function of the URL alone — which is also what makes it a stable query key:
 * back and forward land on a cache entry instead of a request.
 */

/** Below this, the sample is too thin for the cloud to mean anything. */
export const SPARSE_POINTS = 10

export function heatmapFilters(search: HeatmapSearch): HeatmapPointsFilters {
  const windowed = search.from !== undefined && search.to !== undefined

  return {
    phaseId: search.phase,
    // Already integers: `heatmapSearch` parses them, and a malformed
    // `track_ids` is an uncaught `ValueError` server-side — a 500, not a 422.
    trackIds: search.tracks,
    // `both` is the backend's own no-op, so it is left off the wire rather than
    // sent as a filter that does nothing.
    perspective: search.perspective === 'both' ? undefined : search.perspective,
    // Both bounds or neither; the backend ignores a lone one, which would show
    // more of the match than the URL claims.
    windowStartS: windowed ? search.from : undefined,
    windowEndS: windowed ? search.to : undefined,
  }
}

/** Whether anything is narrowing the cloud, which is what makes a thin sample explainable. */
export function isFiltered(search: HeatmapSearch): boolean {
  return (
    search.phase !== undefined ||
    search.perspective !== 'both' ||
    (search.tracks !== undefined && search.tracks.length > 0) ||
    (search.from !== undefined && search.to !== undefined)
  )
}

/**
 * What `?phase=` becomes when the timeline selection changes.
 *
 * The shared timeline is this section's phase picker, so the two have to agree
 * without fighting. Three rules, and the third is why the back button works:
 *
 * - picking a phase filters on it;
 * - clearing the *active* phase drops the filter;
 * - anything else — picking a play, clearing a play — leaves the filter alone.
 *   A history entry that only changed the URL must not be pushed back forward
 *   by a store that still holds the old selection.
 */
export function phaseFromSelection(
  previousItemId: string | null,
  itemId: string | null,
  phase: number | undefined,
): number | undefined {
  const picked = phaseIdFromItem(itemId)
  if (picked !== null) return picked

  const cleared =
    itemId === null && phase !== undefined && previousItemId === phaseItemId(phase)

  return cleared ? undefined : phase
}
