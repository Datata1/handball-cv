import { DURATION_S } from '@/features/report/stories/report'
import {
  type GoalEvent,
  type MatchStats,
  type NormalisedTeam,
  type ScoreboardSummary,
  ZONE_ORDER,
  type ZoneCount,
  type ZoneIntensity,
} from '@/shared/api'

export { teamName } from '@/features/report/stories/report'

/**
 * `/stats` and `/scoreboard/summary` for the same 40-minute match the report
 * stories use, so a story of a section and a story of the shell describe one
 * match rather than two.
 */

const ZONE_LABELS: Record<(typeof ZONE_ORDER)[number], string> = {
  LA: 'Linksaußen',
  RL: 'Rückraum links',
  RM: 'Rückraum Mitte',
  RR: 'Rückraum rechts',
  RA: 'Rechtsaußen',
  KL: 'Kreisläufer',
}

/** Always six entries in `ZONE_ORDER` — the schema enforces both. */
function intensities(values: readonly number[]): ZoneIntensity[] {
  return ZONE_ORDER.map((zone, index) => ({
    zone,
    label: ZONE_LABELS[zone],
    intensity: values[index] ?? 0,
  }))
}

function counts(team: NormalisedTeam, base: number): ZoneCount[] {
  return ZONE_ORDER.map((zone, index) => ({
    team,
    zone,
    label: ZONE_LABELS[zone],
    count: base * (index + 1),
  }))
}

const byTeam = (base: number) => ({
  A: counts('A', base),
  B: counts('B', base + 20),
  U: counts('U', 3),
})

export const stats: MatchStats = {
  match_id: 'seed01',
  total_frames: DURATION_S * 25,
  fps: 25,
  duration_seconds: DURATION_S,
  players_detected: 34,
  ball_detection_rate: 71.4,
  player_detection_rate: 98.2,
  field_detection_rate: 86.5,
  possession_a: 54.3,
  possession_b: 41.2,
  player_stats: [
    {
      track_id: 3,
      team: 'A',
      frame_count: 41_200,
      avg_confidence_pct: 88.4,
      distance_m: 4_312.6,
    },
    {
      track_id: 7,
      team: 'B',
      frame_count: 38_900,
      avg_confidence_pct: 85.1,
      distance_m: 4_008.2,
    },
  ],
  heatmap_left: intensities([12, 48, 100, 51, 14, 63]),
  heatmap_right: intensities([9, 44, 92, 47, 11, 58]),
  heatmap_left_by_team: byTeam(40),
  heatmap_right_by_team: byTeam(35),
  heatmap_points: [
    { x: 12.4, y: 8.1, team: 'A' },
    { x: 27.9, y: 11.6, team: 'B' },
    { x: 20.1, y: 4.3, team: 'U' },
  ],
}

/** No frame had a ball holder the classifier could place. */
export const noPossessionStats: MatchStats = {
  ...stats,
  possession_a: 0,
  possession_b: 0,
}

/** Both teams placed for every possession frame, so nothing is unassigned. */
export const wholePossessionStats: MatchStats = {
  ...stats,
  possession_a: 57.5,
  possession_b: 42.5,
}

/**
 * The row the read freeze leaves behind: the endpoint answers, and every figure
 * in it is a zero the backend wrote because it divided by no frames.
 */
export const unmeasuredStats: MatchStats = {
  ...stats,
  total_frames: 0,
  duration_seconds: 0,
  players_detected: 0,
  ball_detection_rate: 0,
  player_detection_rate: 0,
  field_detection_rate: 0,
  possession_a: 0,
  possession_b: 0,
  player_stats: [],
  heatmap_points: [],
}

function goal(
  frame: number,
  team: GoalEvent['team'],
  home: number,
  away: number,
  gameTime: string | null = null,
): GoalEvent {
  return {
    frame_number: frame,
    timestamp_sec: frame / 25,
    game_time: gameTime,
    team,
    score_home: home,
    score_away: away,
  }
}

export const goals: GoalEvent[] = [
  goal(3_450, 'home', 1, 0, '02:18'),
  goal(10_050, 'away', 1, 1, '06:42'),
  goal(18_375, 'home', 2, 1, '12:15'),
  goal(24_900, 'home', 3, 1, '16:36'),
  // The OCR lost the clock for this one; the row still knows where it is.
  goal(31_200, 'away', 3, 2),
  goal(42_750, 'home', 4, 2, '28:30'),
  goal(51_000, 'away', 4, 3, '34:00'),
  goal(57_300, 'home', 5, 3, '38:12'),
]

export const summary: ScoreboardSummary = {
  match_id: 'seed01',
  final_score_home: 5,
  final_score_away: 3,
  final_game_time: '40:00',
  goals,
}

/** Readings exist, but none ever carried both scores at once. */
export const noFinalScoreSummary: ScoreboardSummary = {
  ...summary,
  final_score_home: null,
  final_score_away: null,
  final_game_time: null,
}

export const noGoalsSummary: ScoreboardSummary = {
  ...summary,
  final_score_home: 0,
  final_score_away: 0,
  goals: [],
}

export const blowoutSummary: ScoreboardSummary = {
  ...summary,
  final_score_home: 38,
  final_score_away: 12,
}
