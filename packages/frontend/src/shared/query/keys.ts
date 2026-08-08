import type {
  FormationSceneFilters,
  HeatmapPointsFilters,
  PlayFilters,
  TeamPhaseFilters,
} from '@/shared/api'

/**
 * Every query key in the app, built here and nowhere else.
 *
 * Keys are hierarchical so one `invalidateQueries` can drop a whole subtree:
 * `qk.match(id)` is a prefix of `qk.stats(id)`, `qk.plays(id, …)` and the rest,
 * so a match going `done` refreshes everything that match owns in one call.
 *
 * Note the `'list'` / `'detail'` segment. The obvious shape — `['matches']` for
 * the list and `['matches', id]` for one match — makes the list key a prefix of
 * *every* match subtree, so invalidating the dashboard would silently refetch
 * every open report. Since the SSE bridge invalidates the list on every status
 * event, that is the difference between one refetch and a stampede.
 *
 * Filters are embedded in the key rather than folded into one query: they come
 * from URL search params (PRs 16–18), so each combination caching independently
 * is what makes back/forward navigation hit warm cache. Query hashes keys with
 * a stable, key-sorted stringify, so property order in the filter object does
 * not matter.
 */
export const qk = {
  /** Everything below `matches`. The nuclear option — reconnect does not use it. */
  all: () => ['matches'] as const,

  /** The dashboard list. Deliberately *not* a prefix of any single match. */
  matches: () => ['matches', 'list'] as const,

  /** One match's subtree root. Invalidate to drop every query below. */
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
