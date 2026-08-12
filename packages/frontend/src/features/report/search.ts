import { z } from 'zod'

import { TRACK_SORT_KEYS } from '@/features/players/tracks'

/**
 * The report's URL contract — every drill-in a section offers, as a search
 * param rather than a path segment. Picking a formation *filters* the section;
 * it is not a different resource, and keeping the section mounted is what
 * avoids a refetch on every click.
 *
 * Two rules run through the schemas below:
 *
 * - A param that only narrows a view falls back to its default when it does not
 *   parse. A garbled `?mode=` is noise, and an error page is a worse answer to
 *   it than the unfiltered view.
 * - The time window does not. Dropping half of `from`/`to` would show more of
 *   the match than the URL claims, so a lone bound is rejected outright and the
 *   route's error boundary says so.
 */

/**
 * Formation names, play types and team ids are backend labels, so they are open
 * strings — an enum here would silently drop a class the model learns next.
 * `?team=` (present but empty) is not a filter; it collapses to absent.
 */
const label = z.string().trim().min(1).optional().catch(undefined)

/**
 * `?at=` is the playhead, and it lives on the layout route because the player
 * is shared by every section — so a link to a moment survives switching tabs.
 */
export const reportSearch = z.object({
  at: z.number().nonnegative().optional().catch(undefined),
})

export const defenseSearch = z.object({
  team: label,
  formation: label,
})

export const offenseSearch = z.object({
  playType: label,
})

/**
 * The tracks table's order and team filter, so a trainer can send someone the
 * table as they are reading it.
 *
 * Neither has a zod `.default()`: a defaulted param is re-serialised into the
 * URL by any navigation, including one that does not touch it, so `?sort=` would
 * appear the first time a section link is followed. The section resolves the
 * default instead.
 */
export const playersSearch = z.object({
  team: label,
  sort: z.enum(TRACK_SORT_KEYS).optional().catch(undefined),
  dir: z.enum(['ascending', 'descending']).optional().catch(undefined),
})

export const heatmapSearch = z
  .object({
    mode: z.enum(['density', 'tiles']).default('density').catch('density'),
    perspective: z.enum(['offense', 'defense', 'both']).default('both').catch('both'),
    phase: z.int().nonnegative().optional().catch(undefined),
    /**
     * Kept as an array here and joined into the backend's comma-separated
     * `track_ids` in the API layer: a malformed value is an uncaught
     * `ValueError` server-side — a 500, not a 422 — so no user text may reach
     * it verbatim.
     */
    tracks: z.array(z.int()).optional().catch(undefined),
    from: z.number().nonnegative().optional(),
    to: z.number().nonnegative().optional(),
  })
  .refine((search) => (search.from === undefined) === (search.to === undefined), {
    error: 'from and to are only meaningful together',
    path: ['to'],
  })

/** Defaults live in the schema; this keeps them out of the URL. */
export const heatmapDefaults = {
  mode: 'density',
  perspective: 'both',
} as const

export type ReportSearch = z.infer<typeof reportSearch>
export type DefenseSearch = z.infer<typeof defenseSearch>
export type OffenseSearch = z.infer<typeof offenseSearch>
export type PlayersSearch = z.infer<typeof playersSearch>
export type HeatmapSearch = z.infer<typeof heatmapSearch>
