import domain from '@/i18n/locales/de/domain.json'
import type { PlayEvent, PlaySummary } from '@/shared/api'

/**
 * `play-summary` and `plays` as the backend writes them.
 *
 * Deliberately not a clean set of the four types the legacy dictionary knew:
 * one play type is in no frontend dictionary, one has no rated attacks, one
 * event carries no trajectories and one carries trajectories this cannot draw.
 * All four are what these views have to survive.
 */

export const summary: PlaySummary[] = [
  {
    play_type: 'kreuzen',
    team: 'A',
    count: 14,
    avg_confidence: 0.81,
    attacks_rated: 9,
    attacks_goal: 4,
    success_rate: 0.444,
  },
  {
    play_type: 'kreuzen',
    team: 'B',
    count: 6,
    avg_confidence: 0.66,
    attacks_rated: 3,
    attacks_goal: 2,
    success_rate: 0.667,
  },
  {
    // Detected, but the scoreboard never settled an attack it was part of.
    play_type: 'einlaeufer',
    team: 'A',
    count: 8,
    avg_confidence: 0.55,
    attacks_rated: 0,
    attacks_goal: 0,
    success_rate: null,
  },
  {
    play_type: 'tempogegenstoss',
    team: 'B',
    count: 11,
    avg_confidence: 0.74,
    attacks_rated: 7,
    attacks_goal: 5,
    success_rate: 0.714,
  },
  {
    // A label no dictionary knows, as the GCN + LSTM work will produce.
    play_type: 'rueckraumdurchbruch',
    team: 'B',
    count: 3,
    avg_confidence: 0.42,
    attacks_rated: 0,
    attacks_goal: 0,
    success_rate: null,
  },
]

/** A match nobody read a scoreboard for: counts, but nothing to rate them by. */
export const unratedSummary: PlaySummary[] = summary.map((row) => ({
  ...row,
  attacks_rated: 0,
  attacks_goal: 0,
  success_rate: null,
}))

/** Two backs swapping sides in front of the left goal. */
const crossing = {
  goal_x: 0,
  cross_time_s: 124.4,
  pair_distance_m: 2.1,
  variante: 'kreuzen',
  tracks: [
    {
      track_id: 3,
      points: [
        [118, 14.2, 6.8],
        [121, 12.6, 8.4],
        [124, 10.8, 10.9],
        [128, 9.4, 13.2],
        [131, 8.1, 14.6],
      ],
    },
    {
      track_id: 7,
      points: [
        [118, 13.9, 13.4],
        [121, 12.2, 11.8],
        [124, 10.5, 9.3],
        [128, 9.1, 7.1],
        [131, 7.9, 5.6],
      ],
    },
  ],
}

/** The fast-break detector stores the team centroid, which is not a player. */
const breakaway = {
  goal_x: 40,
  distance_m: 24.8,
  mean_speed_ms: 5.6,
  tracks: [
    {
      track_id: -1,
      points: [
        [1_204, 12.4, 9.8],
        [1_206, 19.7, 10.4],
        [1_208, 27.1, 11.2],
        [1_210, 33.6, 10.1],
      ],
    },
  ],
}

/** Points that are not `[t, x, y]`: a shape the court cannot draw. */
const unusable = {
  goal_x: 0,
  tracks: [{ track_id: 5, points: [[118, 12]] }],
}

export const plays: PlayEvent[] = [
  {
    event_id: 11,
    play_type: 'kreuzen',
    team: 'A',
    start_frame: 2_950,
    end_frame: 3_275,
    start_time_s: 118,
    end_time_s: 131,
    confidence: 0.82,
    track_ids: [3, 7],
    details: crossing,
    sequence_id: 1,
    outcome: 'goal',
    label: null,
  },
  {
    // A detector run that stored no trajectories, and a verdict a coach left
    // behind before the label loop was deferred.
    event_id: 12,
    play_type: 'kreuzen',
    team: 'B',
    start_frame: 9_700,
    end_frame: 9_975,
    start_time_s: 388,
    end_time_s: 399,
    confidence: 0.61,
    track_ids: [12, 14],
    details: null,
    sequence_id: 2,
    outcome: 'no_goal',
    label: 'correct',
  },
  {
    // The backward-compatible query path: no attack sequence, so the outcome
    // is unknown rather than "no goal".
    event_id: 13,
    play_type: 'kreuzen',
    team: 'A',
    start_frame: 15_000,
    end_frame: 15_400,
    start_time_s: 600,
    end_time_s: 616,
    confidence: 0.49,
    track_ids: [5],
    details: unusable,
    sequence_id: null,
    outcome: null,
    label: null,
  },
  {
    event_id: 14,
    play_type: 'tempogegenstoss',
    team: 'B',
    start_frame: 30_100,
    end_frame: 30_250,
    start_time_s: 1_204,
    end_time_s: 1_210,
    confidence: 0.77,
    track_ids: [],
    details: breakaway,
    sequence_id: 5,
    outcome: 'goal',
    label: null,
  },
]

const TEAM_NAMES: Record<string, string> = { A: 'HSG Nord', B: 'TV Süd' }

/** Names the teams the way the shell does, without an i18n lookup. */
export const teamName = (team: string): string => TEAM_NAMES[team.toUpperCase()] ?? team

/**
 * `useBackendLabel()` over the real `domain` dictionary — including its
 * fallback, which is what makes an unknown play type render as itself.
 */
export const label = (group: string, value: string): string => {
  const entries: Record<string, string> =
    (domain as Record<string, Record<string, string>>)[group] ?? {}

  return entries[value] ?? value
}
