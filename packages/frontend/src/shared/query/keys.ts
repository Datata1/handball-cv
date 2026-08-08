import type {
  FormationSceneFilters,
  HeatmapPointsFilters,
  PlayFilters,
  TeamPhaseFilters,
} from '@/shared/api'

/**
 * Every query key in the app.
 *
 * `invalidateQueries` matches on key prefix, which is what the `'list'` /
 * `'detail'` segment is for: the match list must not be a prefix of any single
 * match, because the SSE bridge invalidates the list on every status event.
 *
 * Filters belong in the key — they come from URL search params, so each
 * combination caches separately and back/forward navigation hits warm cache.
 */
export const qk = {
  /** Only the freeze sweep in `sse.ts` needs this. */
  all: () => ['matches'] as const,

  matches: () => ['matches', 'list'] as const,

  /** Prefix of everything below, so one call drops a whole match. */
  match: (matchId: string) => ['matches', 'detail', matchId] as const,

  stats: (matchId: string) => ['matches', 'detail', matchId, 'stats'] as const,

  heatmap: (matchId: string, filters: HeatmapPointsFilters) =>
    ['matches', 'detail', matchId, 'heatmap', filters] as const,

  scoreboard: (matchId: string) =>
    ['matches', 'detail', matchId, 'scoreboard'] as const,

  scoreboardSummary: (matchId: string) =>
    ['matches', 'detail', matchId, 'scoreboard', 'summary'] as const,

  goals: (matchId: string) => ['matches', 'detail', matchId, 'goals'] as const,

  formationSummary: (matchId: string) =>
    ['matches', 'detail', matchId, 'formation-summary'] as const,

  formationScenes: (matchId: string, filters: FormationSceneFilters) =>
    ['matches', 'detail', matchId, 'formation-scenes', filters] as const,

  plays: (matchId: string, filters: PlayFilters) =>
    ['matches', 'detail', matchId, 'plays', filters] as const,

  playSummary: (matchId: string) =>
    ['matches', 'detail', matchId, 'play-summary'] as const,

  attacks: (matchId: string) => ['matches', 'detail', matchId, 'attacks'] as const,

  teamPhases: (matchId: string, filters: TeamPhaseFilters) =>
    ['matches', 'detail', matchId, 'team-phases', filters] as const,

  outputVideo: (matchId: string) =>
    ['matches', 'detail', matchId, 'output-video'] as const,
} as const
