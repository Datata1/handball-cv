import { useQuery } from '@tanstack/react-query'

import { getHeatmapPoints, type HeatmapPointsFilters } from '@/shared/api'
import { qk, staleTime } from '@/shared/query'

/**
 * The point cloud and the tracks it could be narrowed to.
 *
 * The filters are the URL, so every combination is its own cache entry and
 * stepping back through them costs nothing. `enabled` is what keeps the tile
 * view — which is built from `/stats` and cannot be filtered — from paying for a
 * 12 000-point request it would never draw.
 */
export function useHeatmapPoints(
  matchId: string,
  filters: HeatmapPointsFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.heatmap(matchId, filters),
    queryFn: ({ signal }) => getHeatmapPoints(matchId, filters, signal),
    staleTime: staleTime.heatmap,
    enabled,
  })
}
