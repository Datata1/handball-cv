import { z } from 'zod'

/**
 * Primitives shared across routers — and, more importantly, the three `team`
 * domains the backend keeps in one response.
 */

/**
 * `heatmap_points[].team`, in both `/stats` and `/heatmap-points`. Normalised
 * by a SQL `CASE`, so the domain really is closed.
 */
export const normalisedTeamSchema = z.enum(['A', 'B', 'U'])
export type NormalisedTeam = z.infer<typeof normalisedTeamSchema>

/**
 * `available_track_ids[].team` — the *raw* column, in the same response as the
 * normalised one above. A track the team classifier could not place comes back
 * as `"unknown"`, not `"U"`. Do not reuse `normalisedTeamSchema` here; the
 * response would fail to parse on the first unassigned track.
 */
export const rawTeamSchema = z.string()

/** `player_stats[].team` — raw, and SQL-nullable. */
export const nullableTeamSchema = z.string().nullable()

/** `GoalEvent.team` — a Pydantic `Literal`, so this one is enforced server-side. */
export const goalTeamSchema = z.enum(['home', 'away'])
export type GoalTeam = z.infer<typeof goalTeamSchema>

export const matchStatusSchema = z.enum(['processing', 'done', 'failed', 'unknown'])
export type MatchStatus = z.infer<typeof matchStatusSchema>

/**
 * Handball court zones, in the order `/stats` emits them. The backend builds
 * both heatmap arrays from this exact list, which is why they are always six
 * entries long and always in this order.
 */
export const ZONE_ORDER = ['LA', 'RL', 'RM', 'RR', 'RA', 'KL'] as const
export const zoneCodeSchema = z.enum(ZONE_ORDER)
export type ZoneCode = z.infer<typeof zoneCodeSchema>

/** One entry of FastAPI's 422 body. */
export const validationIssueSchema = z.object({
  loc: z.array(z.union([z.string(), z.number()])),
  msg: z.string(),
  type: z.string(),
})
export type ValidationIssue = z.infer<typeof validationIssueSchema>

/**
 * Covers every error the API can return: no custom exception handlers are
 * registered, so it is always FastAPI's default — a string for `HTTPException`,
 * an issue array for a request-validation failure.
 */
export const errorBodySchema = z.union([
  z.object({ detail: z.string() }),
  z.object({ detail: z.array(validationIssueSchema) }),
])
