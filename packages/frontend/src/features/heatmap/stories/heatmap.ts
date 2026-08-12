import { DURATION_S } from '@/features/report/stories/report'
import {
  type AvailableTrack,
  type HeatmapPoint,
  type HeatmapPoints,
  type MatchStats,
  type NormalisedTeam,
  ZONE_ORDER,
  type ZoneCount,
  type ZoneIntensity,
} from '@/shared/api'

/**
 * Names the teams the way the shell does — including the unassigned bucket,
 * which `useBackendLabel` resolves out of the `domain` namespace.
 */
const TEAM_NAMES: Record<string, string> = {
  A: 'HSG Nord',
  B: 'TV Süd',
  U: 'Ohne Teamzuordnung',
}

export const teamName = (team: string): string => TEAM_NAMES[team.toUpperCase()] ?? team

/**
 * `/stats` and `/heatmap-points` for the same 40-minute match the rest of the
 * report stories use.
 *
 * Deliberately awkward in the two ways this section has to survive: the zone
 * counts are lopsided rather than evenly split, and `available_track_ids[].team`
 * is the *raw* column — `"unknown"` next to the normalised `"U"` of the points
 * in the very same response.
 */

const ZONE_LABELS: Record<(typeof ZONE_ORDER)[number], string> = {
  LA: 'Linksaußen',
  RL: 'Rückraum links',
  RM: 'Rückraum Mitte',
  RR: 'Rückraum rechts',
  RA: 'Rechtsaußen',
  KL: 'Kreisläufer',
}

function intensities(values: readonly number[]): ZoneIntensity[] {
  return ZONE_ORDER.map((zone, index) => ({
    zone,
    label: ZONE_LABELS[zone],
    intensity: values[index] ?? 0,
  }))
}

function counts(team: NormalisedTeam, values: readonly number[]): ZoneCount[] {
  return ZONE_ORDER.map((zone, index) => ({
    team,
    zone,
    label: ZONE_LABELS[zone],
    count: values[index] ?? 0,
  }))
}

/** LA is almost entirely team A, RA almost entirely team B, KL barely tracked. */
const LEFT_BY_TEAM = {
  A: counts('A', [1_820, 940, 1_260, 410, 120, 240]),
  B: counts('B', [90, 720, 1_180, 1_460, 1_930, 260]),
  U: counts('U', [40, 60, 180, 70, 50, 30]),
}

const RIGHT_BY_TEAM = {
  A: counts('A', [110, 680, 1_090, 1_380, 1_760, 220]),
  B: counts('B', [1_640, 880, 1_150, 380, 100, 210]),
  U: counts('U', [30, 40, 150, 60, 40, 20]),
}

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
  player_stats: [],
  heatmap_left: intensities([100, 84, 96, 78, 63, 22]),
  heatmap_right: intensities([92, 76, 88, 71, 58, 19]),
  heatmap_left_by_team: LEFT_BY_TEAM,
  heatmap_right_by_team: RIGHT_BY_TEAM,
  heatmap_points: [
    { x: 12.4, y: 8.1, team: 'A' },
    { x: 27.9, y: 11.6, team: 'B' },
    { x: 20.1, y: 4.3, team: 'U' },
  ],
}

/**
 * The match answered, and every zone in it is a zero — no frame ever carried a
 * court position. Distinct from a failed request, and it has to read that way.
 */
export const unmeasuredStats: MatchStats = {
  ...stats,
  heatmap_left: intensities([0, 0, 0, 0, 0, 0]),
  heatmap_right: intensities([0, 0, 0, 0, 0, 0]),
  heatmap_left_by_team: {
    A: counts('A', []),
    B: counts('B', []),
    U: counts('U', []),
  },
  heatmap_right_by_team: {
    A: counts('A', []),
    B: counts('B', []),
    U: counts('U', []),
  },
  heatmap_points: [],
}

function track(
  id: number,
  team: string,
  firstS: number,
  lastS: number,
  frames: number,
): AvailableTrack {
  return {
    track_id: id,
    team,
    first_frame: Math.round(firstS * 25),
    last_frame: Math.round(lastS * 25),
    frame_count: frames,
    first_time_s: firstS,
    last_time_s: lastS,
  }
}

/** Note the raw team column: `"unknown"`, and one id the classifier invented. */
export const availableTracks: AvailableTrack[] = [
  track(3, 'A', 0, 2_180, 41_200),
  track(5, 'A', 12, 1_940, 38_100),
  track(9, 'A', 640, 2_400, 22_800),
  track(7, 'B', 0, 2_310, 39_500),
  track(11, 'B', 30, 2_120, 35_600),
  track(14, 'B', 1_180, 2_400, 18_200),
  track(21, 'unknown', 300, 460, 2_400),
  track(28, 'unknown', 1_500, 1_560, 900),
]

function points(count: number): HeatmapPoint[] {
  const teams: NormalisedTeam[] = ['A', 'B', 'U']

  return Array.from({ length: count }, (_, index) => ({
    x: 2 + ((index * 7.3) % 36),
    y: 1 + ((index * 3.1) % 18),
    team: teams[index % 3] ?? 'U',
  }))
}

export const heatmapPoints: HeatmapPoints = {
  available_track_ids: availableTracks,
  heatmap_points: points(1_240),
}

/** One track over a minute of the match: below what a density view can say anything about. */
export const sparseHeatmapPoints: HeatmapPoints = {
  available_track_ids: availableTracks,
  heatmap_points: points(4),
}

export const emptyHeatmapPoints: HeatmapPoints = {
  available_track_ids: [],
  heatmap_points: [],
}

/** `useBackendLabel()` for the two groups this section looks up. */
export const label = (group: string, value: string): string => {
  const zones: Record<string, string> = ZONE_LABELS
  const phases: Record<string, string> = {
    attack: 'Angriff',
    transition: 'Umschaltspiel',
  }

  if (group === 'zone') return zones[value] ?? value
  if (group === 'phase') return phases[value] ?? value

  return value
}
