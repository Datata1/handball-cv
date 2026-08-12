import { stats } from '@/features/overview/stories/overview'
import { match } from '@/features/report/stories/report'
import type { MatchStats, PlayerStat } from '@/shared/api'

/**
 * Named the way the shell names teams: the trainer's names, and `domain.team`
 * for the bucket the classifier could not place.
 */
const TEAM_NAMES: Record<string, string> = {
  A: match.team_a_name ?? 'A',
  B: match.team_b_name ?? 'B',
  U: 'Ohne Teamzuordnung',
}

export const teamName = (team: string): string => TEAM_NAMES[team.toUpperCase()] ?? team

/**
 * `player_stats` for the same 40-minute match every other report story uses.
 * The overview fixture carries two rows because that section only counts them;
 * this one needs the full response the endpoint caps at 25.
 */

function track(
  track_id: number,
  team: string | null,
  frame_count: number,
  avg_confidence_pct: number,
  distance_m: number,
): PlayerStat {
  return { track_id, team, frame_count, avg_confidence_pct, distance_m }
}

/** Ordered the way the endpoint sends them: `frame_count DESC`, 25 rows. */
export const tracks: PlayerStat[] = [
  track(3, 'A', 41_200, 88.4, 4_312.6),
  track(7, 'B', 38_900, 85.1, 4_008.2),
  track(12, 'B', 37_450, 84.7, 3_884.9),
  track(4, 'A', 36_010, 87.2, 4_101.3),
  track(9, 'A', 34_775, 82.9, 3_620.4),
  track(15, 'B', 33_120, 81.5, 3_517.8),
  track(2, 'A', 31_880, 86.6, 3_902.1),
  track(18, 'B', 30_540, 79.8, 3_344.7),
  track(6, 'A', 29_115, 83.3, 3_208.5),
  track(21, 'B', 27_960, 78.4, 3_066.2),
  // The team classifier never placed these two: `null` from SQL and the string
  // the classifier writes for the same fact.
  track(33, null, 24_300, 61.2, 2_744.9),
  track(41, 'unknown', 21_870, 58.7, 2_412.0),
  track(11, 'A', 20_450, 80.1, 2_299.4),
  track(24, 'B', 19_330, 77.6, 2_154.8),
  track(8, 'A', 17_905, 79.2, 1_988.3),
  track(27, 'B', 16_240, 75.9, 1_802.6),
  track(14, 'A', 14_880, 74.3, 1_655.1),
  track(30, 'B', 13_110, 72.8, 1_477.5),
  track(19, 'A', 11_640, 70.4, 1_302.9),
  track(36, 'B', 9_985, 68.1, 1_144.2),
  track(22, 'A', 8_470, 66.7, 954.6),
  track(39, 'B', 6_920, 64.5, 781.3),
  track(26, 'A', 5_310, 62.2, 604.8),
  track(44, 'B', 3_780, 59.9, 428.5),
  // Ties with 44 on frames: the second sort key decides, in both directions.
  track(45, null, 3_780, 41.5, 96.2),
]

export const statsWithTracks: MatchStats = { ...stats, player_stats: tracks }

/** A handful, all placed — the shape of a short clip rather than a full match. */
export const fewTracksStats: MatchStats = {
  ...stats,
  player_stats: tracks.slice(0, 3),
}

/** No track was placed at all: every bucket is the unassigned one. */
export const unplacedTracksStats: MatchStats = {
  ...stats,
  player_stats: [
    track(33, null, 24_300, 61.2, 2_744.9),
    track(41, 'unknown', 21_870, 58.7, 2_412.0),
  ],
}

/** The endpoint answered, and the ingestion stored no person for this match. */
export const noTracksStats: MatchStats = { ...stats, player_stats: [] }

/**
 * The ends of every column at once: a track seen twice, one seen almost always,
 * a distance of nothing and one no player runs.
 */
export const extremeTracksStats: MatchStats = {
  ...stats,
  player_stats: [
    track(1, 'A', 2, 12.5, 0),
    track(2, 'B', 59_998, 99.9, 12_480.75),
    track(3, null, 15_000, 0, 0.05),
  ],
}
