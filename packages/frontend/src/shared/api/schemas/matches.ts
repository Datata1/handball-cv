import { z } from 'zod'

import {
  goalTeamSchema,
  matchStatusSchema,
  normalisedTeamSchema,
  nullableTeamSchema,
  rawTeamSchema,
  zoneCodeSchema,
} from './common'

/**
 * No `.min(1)`, no `.nonempty()`, no `.positive()` anywhere in here.
 *
 * `GET /matches` appends a degenerate row for every match that has a status
 * file but no DuckDB row — `file_name: ""`, `video_path: ""`, `fps: 0`,
 * `total_frames: 0`, everything else `null`. And because `query_duckdb` returns
 * `[]` while *any* match is processing, the healthy matches degenerate to the
 * same shape for the duration. A stricter schema fails the whole dashboard
 * exactly when a match is being ingested.
 */
export const matchMetaSchema = z.object({
  match_id: z.string(),
  file_name: z.string(),
  video_path: z.string(),
  fps: z.number(),
  total_frames: z.int(),
  status: matchStatusSchema,
  /** `"MM:SS"`, derived server-side. */
  duration: z.string().nullable(),
  /** ISO 8601; `date` and `ingested_at` are the same value. */
  date: z.string().nullable(),
  ingested_at: z.string().nullable(),
  display_name: z.string().nullable(),
  team_a_name: z.string().nullable(),
  team_b_name: z.string().nullable(),
})
export type MatchMeta = z.infer<typeof matchMetaSchema>

export const matchListSchema = z.array(matchMetaSchema)

/** `PATCH` body. Omitted fields are left alone; `null` cannot clear a field. */
export const matchPatchSchema = z.object({
  display_name: z.string().optional(),
  team_a_name: z.string().optional(),
  team_b_name: z.string().optional(),
})
export type MatchPatch = z.infer<typeof matchPatchSchema>

export const matchPatchResultSchema = z.object({ ok: z.boolean() })

export const matchDeleteResultSchema = z.object({
  ok: z.boolean(),
  deleted: z.string(),
})

export const playerStatSchema = z.object({
  track_id: z.int(),
  team: nullableTeamSchema,
  frame_count: z.int(),
  avg_confidence_pct: z.number(),
  distance_m: z.number(),
})
export type PlayerStat = z.infer<typeof playerStatSchema>

/** `heatmap_left` / `heatmap_right`: **normalised 0–100**, relative to the busiest zone. */
export const zoneIntensitySchema = z.object({
  zone: zoneCodeSchema,
  label: z.string(),
  intensity: z.number(),
})
export type ZoneIntensity = z.infer<typeof zoneIntensitySchema>

/**
 * `heatmap_*_by_team`: **absolute counts**. Same endpoint, same concept,
 * different field name and different semantics from `zoneIntensitySchema` —
 * hence a separate schema rather than a shared one with an optional field.
 */
export const zoneCountSchema = z.object({
  team: normalisedTeamSchema,
  zone: zoneCodeSchema,
  label: z.string(),
  count: z.int(),
})
export type ZoneCount = z.infer<typeof zoneCountSchema>

/** Always six entries, always in `ZONE_ORDER` — the backend builds them from that list. */
const zoneIntensitiesSchema = z.array(zoneIntensitySchema).length(6)
const zoneCountsByTeamSchema = z.object({
  A: z.array(zoneCountSchema).length(6),
  B: z.array(zoneCountSchema).length(6),
  U: z.array(zoneCountSchema).length(6),
})

/**
 * A court position sample. `track_id` is **not** here — the SQL selects it and
 * the response builder drops it, in both endpoints that return this shape. Per
 * track colouring is a backend gap; do not try to reconstruct it client-side.
 */
export const heatmapPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  team: normalisedTeamSchema,
})
export type HeatmapPoint = z.infer<typeof heatmapPointSchema>

export const matchStatsSchema = z.object({
  match_id: z.string(),
  total_frames: z.int(),
  fps: z.number(),
  duration_seconds: z.number(),
  players_detected: z.int(),
  /** Percentages, 0–100, already rounded to one decimal. */
  ball_detection_rate: z.number(),
  player_detection_rate: z.number(),
  field_detection_rate: z.number(),
  possession_a: z.number(),
  possession_b: z.number(),
  /** Top 25 tracks by frame count. Tracks, not players — one player may hold several. */
  player_stats: z.array(playerStatSchema),
  heatmap_left: zoneIntensitiesSchema,
  heatmap_right: zoneIntensitiesSchema,
  heatmap_left_by_team: zoneCountsByTeamSchema,
  heatmap_right_by_team: zoneCountsByTeamSchema,
  /** Every 100th frame, capped at 12 000 points. */
  heatmap_points: z.array(heatmapPointSchema),
})
export type MatchStats = z.infer<typeof matchStatsSchema>

/** Note `team` here is raw: an unassigned track is `"unknown"`, not `"U"`. */
export const availableTrackSchema = z.object({
  track_id: z.int(),
  team: rawTeamSchema,
  first_frame: z.int(),
  last_frame: z.int(),
  frame_count: z.int(),
  first_time_s: z.number(),
  last_time_s: z.number(),
})
export type AvailableTrack = z.infer<typeof availableTrackSchema>

export const heatmapPointsSchema = z.object({
  available_track_ids: z.array(availableTrackSchema),
  heatmap_points: z.array(heatmapPointSchema),
})
export type HeatmapPoints = z.infer<typeof heatmapPointsSchema>

export const scoreboardReadingSchema = z.object({
  frame_number: z.int(),
  timestamp_sec: z.number(),
  game_time: z.string().nullable(),
  score_home: z.int().nullable(),
  score_away: z.int().nullable(),
})
export type ScoreboardReading = z.infer<typeof scoreboardReadingSchema>

export const scoreboardSchema = z.array(scoreboardReadingSchema)

/** From `/scoreboard/summary`, where a Pydantic `Literal` guarantees the team. */
export const goalEventSchema = z.object({
  frame_number: z.int(),
  timestamp_sec: z.number(),
  game_time: z.string().nullable(),
  team: goalTeamSchema,
  score_home: z.int(),
  score_away: z.int(),
})
export type GoalEvent = z.infer<typeof goalEventSchema>

/**
 * From `/goals` — the same rows, hand-serialised with no `response_model`, so
 * `team` is whatever the detector wrote. Prefer the summary endpoint.
 */
export const goalRowSchema = goalEventSchema.extend({ team: z.string() })
export type GoalRow = z.infer<typeof goalRowSchema>

export const goalsSchema = z.array(goalRowSchema)

export const scoreboardSummarySchema = z.object({
  match_id: z.string(),
  final_score_home: z.int().nullable(),
  final_score_away: z.int().nullable(),
  final_game_time: z.string().nullable(),
  goals: z.array(goalEventSchema),
})
export type ScoreboardSummary = z.infer<typeof scoreboardSummarySchema>
