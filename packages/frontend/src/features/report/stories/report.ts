import { fn } from 'storybook/test'

import type {
  FormationScene,
  GoalEvent,
  MatchMeta,
  PlayEvent,
  TeamPhase,
} from '@/shared/api'
import type { MatchRename } from '@/shared/matches'

/**
 * One 40-minute match as the four endpoints the shell reads describe it,
 * shared by every report story.
 */

export const DURATION_S = 2_400

export const match: MatchMeta = {
  match_id: 'seed01',
  file_name: 'seed01.mp4',
  video_path: '/srv/wels/data/input/videos/seed01.mp4',
  fps: 25,
  total_frames: DURATION_S * 25,
  status: 'done',
  date: '2026-08-07T20:15:00',
  duration: '40:00',
  ingested_at: '2026-08-07T23:32:40.153507',
  display_name: 'Testspiel Nord vs Süd',
  team_a_name: 'HSG Nord',
  team_b_name: 'TV Süd',
}

/** No names set: the header falls back to the file name and to "Mannschaft A". */
export const unnamedMatch: MatchMeta = {
  ...match,
  display_name: null,
  team_a_name: null,
  team_b_name: null,
}

export const longNamesMatch: MatchMeta = {
  ...match,
  display_name: 'Landesliga Nord — 14. Spieltag, Nachholspiel im Sportpark Ost',
  team_a_name: 'Handballspielgemeinschaft Nordheide-Winsen II',
  team_b_name: 'Turn- und Sportverein Süderelbe von 1897 e. V.',
}

/** The stub row `GET /matches` appends while the pipeline is still running. */
export const processingMatch: MatchMeta = {
  ...match,
  file_name: '',
  video_path: '',
  fps: 0,
  total_frames: 0,
  status: 'processing',
  date: null,
  duration: null,
  ingested_at: null,
}

export const phases: TeamPhase[] = [
  {
    phase_id: 1,
    offense_team: 'A',
    defense_team: 'B',
    phase_type: 'attack',
    start_frame: 3_000,
    end_frame: 3_525,
    start_time_s: 120,
    end_time_s: 141,
  },
  {
    phase_id: 2,
    offense_team: 'B',
    defense_team: 'A',
    phase_type: 'attack',
    start_frame: 9_500,
    end_frame: 10_250,
    start_time_s: 380,
    end_time_s: 410,
  },
  {
    phase_id: 3,
    offense_team: 'A',
    defense_team: 'B',
    phase_type: 'transition',
    start_frame: 22_500,
    end_frame: 23_700,
    start_time_s: 900,
    end_time_s: 948,
  },
]

export const goals: GoalEvent[] = [
  {
    frame_number: 3_450,
    timestamp_sec: 138,
    game_time: '02:18',
    team: 'home',
    score_home: 1,
    score_away: 0,
  },
  {
    frame_number: 10_050,
    timestamp_sec: 402,
    game_time: '06:42',
    team: 'away',
    score_home: 1,
    score_away: 1,
  },
]

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
    details: null,
    sequence_id: 1,
    outcome: 'goal',
    label: null,
  },
  {
    // A type no dictionary knows: it renders as itself rather than vanishing.
    event_id: 12,
    play_type: 'rueckraumdurchbruch',
    team: 'B',
    start_frame: 9_700,
    end_frame: 9_975,
    start_time_s: 388,
    end_time_s: 399,
    confidence: 0.61,
    track_ids: [12],
    details: null,
    sequence_id: 2,
    outcome: 'no_goal',
    label: null,
  },
]

export const formations: FormationScene[] = [
  {
    scene_id: 1,
    team: 'B',
    formation: '6-0',
    start_frame: 0,
    end_frame: 20_000,
    start_time_s: 0,
    end_time_s: 800,
  },
  {
    scene_id: 2,
    team: 'A',
    formation: '5-1',
    start_frame: 20_000,
    end_frame: 45_000,
    start_time_s: 800,
    end_time_s: 1_800,
  },
  {
    scene_id: 3,
    team: 'B',
    formation: '3-2-1',
    start_frame: 45_000,
    end_frame: 60_000,
    start_time_s: 1_800,
    end_time_s: DURATION_S,
  },
]

const TEAM_NAMES: Record<string, string> = { A: 'HSG Nord', B: 'TV Süd' }

/** Names the teams the way the shell does, without an i18n lookup. */
export const teamName = (team: string): string => TEAM_NAMES[team.toUpperCase()] ?? team

/** An idle `useRenameMatch()`. Pass the one field a story is about. */
export function rename(state: Partial<MatchRename> = {}): MatchRename {
  return { rename: fn(), saving: null, failed: null, ...state }
}
