import { z } from 'zod'

/**
 * The dashboard's URL contract. Search and sort are in the URL for the same
 * reason the report's filters are: a filtered list is then shareable, and the
 * back button undoes a search.
 *
 * Neither param can fail the route — a garbled one falls back to the unfiltered,
 * newest-first list rather than an error page.
 */
export const dashboardSearch = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  sort: z.enum(['recent', 'name']).default('recent').catch('recent'),
})

export type DashboardSearch = z.infer<typeof dashboardSearch>
export type SortKey = DashboardSearch['sort']
