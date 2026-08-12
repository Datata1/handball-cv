import type { MatchStats, NormalisedTeam, ZoneCount, ZoneIntensity } from '@/shared/api'
import { type CourtHalf, ZONE_CODES, type ZoneCode } from '@/shared/court'

/**
 * The zone view of `/stats`, which reports each half twice over.
 *
 * `heatmap_left` / `heatmap_right` carry **`intensity`**, normalised 0–100
 * against the busiest zone of that half. `heatmap_*_by_team` carry **`count`**,
 * absolute and split by team. Same six zones, different field, different
 * meaning — a tile needs both and neither can be derived from the other.
 */

/** The three buckets `heatmap_*_by_team` is keyed by, in the order tiles read them. */
export const TEAM_BUCKETS: readonly NormalisedTeam[] = ['A', 'B', 'U']

export interface ZoneTileData {
  zone: ZoneCode
  /** 0–100, relative to the busiest zone of the same half. */
  intensity: number
  counts: Record<NormalisedTeam, number>
  /** Positions counted in this zone, across all three buckets. */
  total: number
}

function intensityByZone(zones: readonly ZoneIntensity[]): Map<ZoneCode, number> {
  return new Map(zones.map((zone) => [zone.zone, zone.intensity]))
}

function countByZone(zones: readonly ZoneCount[]): Map<ZoneCode, number> {
  return new Map(zones.map((zone) => [zone.zone, zone.count]))
}

/**
 * One half's six tiles, in the fixed zone order rather than the response's.
 *
 * The two arrays are read by zone code, not by index: they are built from the
 * same server-side list today, and a tile that silently took its count from a
 * neighbouring zone would be indistinguishable from real data.
 */
export function zoneTiles(stats: MatchStats, half: CourtHalf): ZoneTileData[] {
  const intensities = intensityByZone(
    half === 'left' ? stats.heatmap_left : stats.heatmap_right,
  )
  const byTeam =
    half === 'left' ? stats.heatmap_left_by_team : stats.heatmap_right_by_team

  const counts = {
    A: countByZone(byTeam.A),
    B: countByZone(byTeam.B),
    U: countByZone(byTeam.U),
  }

  return ZONE_CODES.map((zone) => {
    const zoneCounts = {
      A: counts.A.get(zone) ?? 0,
      B: counts.B.get(zone) ?? 0,
      U: counts.U.get(zone) ?? 0,
    }

    return {
      zone,
      intensity: intensities.get(zone) ?? 0,
      counts: zoneCounts,
      total: zoneCounts.A + zoneCounts.B + zoneCounts.U,
    }
  })
}

/** Whether anything was measured at all — an all-zero half is not a heatmap. */
export function hasZoneActivity(tiles: readonly ZoneTileData[]): boolean {
  return tiles.some((tile) => tile.total > 0 || tile.intensity > 0)
}

/** One bucket's share of a zone, `0`–`1`. */
export function teamShare(tile: ZoneTileData, team: NormalisedTeam): number {
  return tile.total > 0 ? tile.counts[team] / tile.total : 0
}

/**
 * How much of the fill colour a tile carries, and whether its value has to flip
 * to the fill's own foreground to stay readable on it.
 *
 * The ramp starts above zero so a quiet zone still reads as a tile, and the flip
 * sits at 62 %: below it the card foreground clears 4.5:1, above it the fill is
 * dark enough (light enough, in the dark scheme) for `--primary-foreground`.
 * Only the large value sits on the fill — the zone name and the counts stay on
 * the card, where no ramp can reach them.
 */
export const FILL_MIN = 6
export const FILL_MAX = 100
export const INVERT_AT = 62

export interface TileFill {
  /** Percent of `--primary` mixed into `--card`. */
  mix: number
  inverted: boolean
}

export function tileFill(intensity: number): TileFill {
  const clamped = Math.min(100, Math.max(0, intensity))
  const mix = Math.round(FILL_MIN + (clamped / 100) * (FILL_MAX - FILL_MIN))

  return { mix, inverted: mix >= INVERT_AT }
}

/**
 * The fill as an inline style. A Tailwind class cannot hold a computed value —
 * a `bg-primary/${mix}` template is exactly the dead dynamic class the legacy
 * app shipped — and the semantic tokens are what keep it on the palette.
 */
export function tileFillStyle(fill: TileFill): { backgroundColor: string } {
  return {
    backgroundColor: `color-mix(in srgb, var(--primary) ${fill.mix}%, var(--card))`,
  }
}
