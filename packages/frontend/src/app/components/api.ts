export type MatchStatus = 'processing' | 'done' | 'failed' | 'unknown';

export interface MatchMeta {
  match_id: string;
  file_name: string;
  video_path: string;
  fps: number;
  total_frames: number;
  status: MatchStatus;
  date?: string;
  duration?: string;
  display_name?: string;
  team_a_name?: string;
  team_b_name?: string;
}

export interface MatchStats {
  total_frames: number;
  fps: number;
  duration_seconds: number;
  players_detected: number;
  ball_detection_rate: number;
  player_detection_rate: number;
  field_detection_rate: number;
  possession_a: number;
  possession_b: number;
  player_stats: Array<{
    track_id: number;
    team: string;
    frame_count: number;
    avg_confidence_pct: number;
    distance_m: number;
  }>;
  heatmap_left: Array<{
    zone: string;
    label: string;
    intensity: number;
  }>;
  heatmap_right: Array<{
    zone: string;
    label: string;
    intensity: number;
  }>;
  heatmap_left_by_team: Record<string, Array<{
    team: string;
    zone: string;
    label: string;
    count: number;
  }>>;
  heatmap_right_by_team: Record<string, Array<{
    team: string;
    zone: string;
    label: string;
    count: number;
  }>>;
  heatmap_points: Array<{
    x: number;
    y: number;
    team: string;
  }>;
}

const BASE = import.meta.env.VITE_BACKEND_URL || '';

// ── in-flight deduplication ──────────────────────────────────────────────────
// Two concurrent callers for the same resource share one Promise → one request.

let matchesInFlight: Promise<MatchMeta[]> | null = null;

const statsCache = new Map<string, MatchStats>();          // permanent — stats never change
const statsInFlight = new Map<string, Promise<MatchStats | null>>();

// ── public API ───────────────────────────────────────────────────────────────

export async function fetchMatches(): Promise<MatchMeta[]> {
  if (matchesInFlight) return matchesInFlight;
  matchesInFlight = fetch(`${BASE}/api/v1/matches`)
    .then(r => { if (!r.ok) throw new Error('Fehler beim Laden der Matches'); return r.json() as Promise<MatchMeta[]>; })
    .finally(() => { matchesInFlight = null; });
  return matchesInFlight;
}

export async function fetchMatchStats(matchId: string): Promise<MatchStats | null> {
  const cached = statsCache.get(matchId);
  if (cached) return cached;

  const inFlight = statsInFlight.get(matchId);
  if (inFlight) return inFlight;

  const promise = fetch(`${BASE}/api/v1/matches/${matchId}/stats`)
    .then(r => r.ok ? (r.json() as Promise<MatchStats>) : null)
    .then(data => { if (data) statsCache.set(matchId, data); return data; })
    .finally(() => { statsInFlight.delete(matchId); });

  statsInFlight.set(matchId, promise);
  return promise;
}

export interface ScoreboardReading {
  frame_number: number;
  timestamp_sec: number;
  game_time: string;
  score_home: number | null;
  score_away: number | null;
}

export async function fetchLatestScore(matchId: string): Promise<ScoreboardReading | null> {
  const res = await fetch(`${BASE}/api/v1/matches/${matchId}/scoreboard`);
  if (!res.ok) return null;
  const rows: ScoreboardReading[] = await res.json();
  const complete = rows.filter(r => r.score_home !== null && r.score_away !== null);
  return complete.length > 0 ? complete[complete.length - 1] : (rows[rows.length - 1] ?? null);
}

export interface GoalEvent {
  frame_number: number;
  timestamp_sec: number;
  game_time: string | null;
  team: 'home' | 'away';
  score_home: number;
  score_away: number;
}

export async function fetchGoals(matchId: string): Promise<GoalEvent[]> {
  const res = await fetch(`${BASE}/api/v1/matches/${matchId}/goals`);
  if (!res.ok) return [];
  return res.json() as Promise<GoalEvent[]>;
}

export interface ScoreboardData {
  match_id: string;
  final_score_home: number | null;
  final_score_away: number | null;
  final_game_time: string | null;
  goals: GoalEvent[];
}

export async function fetchScoreboardSummary(matchId: string): Promise<ScoreboardData | null> {
  const res = await fetch(`${BASE}/api/v1/matches/${matchId}/scoreboard/summary`);
  if (!res.ok) return null;
  return res.json() as Promise<ScoreboardData>;
}

export interface FormationSummary {
  team: string;
  formations: Record<string, number>;
  dominant: string;
}

export async function fetchFormationSummary(matchId: string): Promise<FormationSummary[] | null> {
  const res = await fetch(`${BASE}/api/v1/matches/${matchId}/formation-summary`);
  if (!res.ok) return null;
  return res.json() as Promise<FormationSummary[]>;
}

export interface FormationScene {
  scene_id: number;
  team: string;
  formation: string;
  start_frame: number;
  end_frame: number;
  start_time_s: number;
  end_time_s: number;
}

export async function fetchFormationScenes(
  matchId: string,
  team?: string,
  formation?: string,
): Promise<FormationScene[]> {
  const params = new URLSearchParams();
  if (team) params.set('team', team);
  if (formation) params.set('formation', formation);
  const qs = params.toString() ? `?${params.toString()}` : '';
  try {
    const res = await fetch(`${BASE}/api/v1/matches/${matchId}/formation-scenes${qs}`);
    if (!res.ok) return [];
    return res.json() as Promise<FormationScene[]>;
  } catch {
    return [];
  }
}

export interface PlayTrack {
  track_id: number;          // -1 marks the team centroid (Tempogegenstoß)
  points: Array<[number, number, number]>;  // [t_seconds, court_x_m, court_y_m]
}

export interface PlayEventDetails {
  goal_x?: number;           // attacked goal: 0 or 40
  tracks?: PlayTrack[];
  [key: string]: unknown;    // detector-specific metrics
}

export interface PlayEvent {
  event_id: number;
  play_type: string;         // 'kreuzen' | 'einlaeufer' | 'parallelstoss' | 'tempogegenstoss'
  team: string;              // attacking team 'A' | 'B'
  start_frame: number;
  end_frame: number;
  start_time_s: number;
  end_time_s: number;
  confidence: number;
  track_ids: number[];
  details: PlayEventDetails | null;
  sequence_id?: number | null;                       // attack the event belongs to
  outcome?: 'goal' | 'no_goal' | 'unknown' | null;   // attack outcome
  label?: 'correct' | 'wrong' | null;                // coach verdict (label loop)
}

export interface PlaySummary {
  play_type: string;
  team: string;
  count: number;
  avg_confidence: number;
  attacks_rated?: number;        // attacks containing this play with known outcome
  attacks_goal?: number;
  success_rate?: number | null;  // attacks_goal / attacks_rated
}

export async function labelPlayEvent(
  matchId: string,
  eventId: number,
  verdict: 'correct' | 'wrong' | null,
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/v1/matches/${matchId}/plays/${eventId}/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verdict }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchPlaySummary(matchId: string): Promise<PlaySummary[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/matches/${matchId}/play-summary`);
    if (!res.ok) return [];
    return res.json() as Promise<PlaySummary[]>;
  } catch {
    return [];
  }
}

export async function fetchPlays(
  matchId: string,
  playType?: string,
  team?: string,
): Promise<PlayEvent[]> {
  const params = new URLSearchParams();
  if (playType) params.set('play_type', playType);
  if (team) params.set('team', team);
  const qs = params.toString() ? `?${params.toString()}` : '';
  try {
    const res = await fetch(`${BASE}/api/v1/matches/${matchId}/plays${qs}`);
    if (!res.ok) return [];
    return res.json() as Promise<PlayEvent[]>;
  } catch {
    return [];
  }
}

export interface TeamPhase {
  phase_id: number;
  offense_team: string;
  defense_team: string;
  phase_type: string;
  start_frame: number;
  end_frame: number;
  start_time_s: number;
  end_time_s: number;
}

export interface TrackInfo {
  track_id: number;
  team: string;
  first_frame: number;
  last_frame: number;
  frame_count: number;
  first_time_s: number;
  last_time_s: number;
}

export interface HeatmapPointsData {
  available_track_ids: TrackInfo[];
  heatmap_points: Array<{ x: number; y: number; team: string }>;
}

export async function fetchHeatmapPoints(
  matchId: string,
  opts?: {
    phaseId?: number;
    trackIds?: number[];
    perspective?: 'offense' | 'defense' | 'both';
    windowStartS?: number;
    windowEndS?: number;
  },
): Promise<HeatmapPointsData | null> {
  try {
    const params = new URLSearchParams();
    if (opts?.phaseId !== undefined) params.set('phase_id', String(opts.phaseId));
    if (opts?.trackIds && opts.trackIds.length > 0) {
      params.set('track_ids', opts.trackIds.join(','));
    }
    if (opts?.perspective && opts.perspective !== 'both') {
      params.set('perspective', opts.perspective);
    }
    if (opts?.windowStartS !== undefined && opts?.windowEndS !== undefined) {
      params.set('window_start_s', String(opts.windowStartS));
      params.set('window_end_s', String(opts.windowEndS));
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${BASE}/api/v1/matches/${matchId}/heatmap-points${qs}`);
    if (!res.ok) return null;
    return res.json() as Promise<HeatmapPointsData>;
  } catch {
    return null;
  }
}

export async function fetchTeamPhases(matchId: string): Promise<TeamPhase[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/matches/${matchId}/team-phases`);
    if (!res.ok) return [];
    return res.json() as Promise<TeamPhase[]>;
  } catch {
    return [];
  }
}

export async function deleteMatch(matchId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/matches/${matchId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Fehler beim Löschen');
}

export async function patchMatch(
  matchId: string,
  data: { display_name?: string; team_a_name?: string; team_b_name?: string },
): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/matches/${matchId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Fehler beim Speichern');
  // Invalidate the stats cache so team-name updates are reflected on next fetch
  statsCache.delete(matchId);
}
