import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getFormationScenes,
  getOutputVideo,
  getPlays,
  getTeamPhases,
  listMatches,
} from '@/shared/api'
import { scoreboardSummaryOptions } from '@/shared/matches'
import { qk, staleTime } from '@/shared/query'

/**
 * Everything the report shell loads, once, for every section below it.
 *
 * The shell is a layout route, so these stay mounted across a section change
 * and a section reads them from the cache rather than fetching again — the
 * legacy report fetched `team-phases` twice for one match, once for its own
 * body and once inside the output-video tab.
 */

/** No filters anywhere: the whole match is loaded once and sections narrow it. */
const ALL = {}

/**
 * This match's meta, off the list every other view already holds.
 *
 * `null` means the list came back without it. That is not proof of absence
 * while a match is processing: the list degenerates to status-file stubs, and a
 * match ingested outside the API has no status file to stub.
 */
export function useMatchMeta(matchId: string) {
  return useQuery({
    queryKey: qk.matches(),
    queryFn: ({ signal }) => listMatches(signal),
    staleTime: staleTime.matches,
    select: (matches) => matches.find((match) => match.match_id === matchId) ?? null,
  })
}

export function useTeamPhases(matchId: string) {
  return useQuery({
    queryKey: qk.teamPhases(matchId, ALL),
    queryFn: ({ signal }) => getTeamPhases(matchId, ALL, signal),
    staleTime: staleTime.teamPhases,
  })
}

/** The goal timeline, and `null` for a match whose scoreboard was never read. */
export function useScoreboardSummary(matchId: string) {
  return useQuery(scoreboardSummaryOptions(matchId, useQueryClient()))
}

export function usePlays(matchId: string) {
  return useQuery({
    queryKey: qk.plays(matchId, ALL),
    queryFn: ({ signal }) => getPlays(matchId, ALL, signal),
    staleTime: staleTime.plays,
  })
}

export function useFormationScenes(matchId: string) {
  return useQuery({
    queryKey: qk.formationScenes(matchId, ALL),
    queryFn: ({ signal }) => getFormationScenes(matchId, ALL, signal),
    staleTime: staleTime.formationScenes,
  })
}

/** How long a dropped SSE stream may hide a finished render. */
const OUTPUT_POLL_MS = 15_000

/**
 * Whether the annotated render exists yet.
 *
 * Reads the status file rather than DuckDB, so it answers during the read
 * freeze like nothing else here does. The status bridge invalidates the match
 * subtree when ingestion finishes; the poll only covers a stream that dropped.
 */
export function useOutputVideo(matchId: string) {
  return useQuery({
    queryKey: qk.outputVideo(matchId),
    queryFn: ({ signal }) => getOutputVideo(matchId, signal),
    staleTime: staleTime.outputVideo,
    refetchInterval: (query) =>
      query.state.data?.status === 'processing' ? OUTPUT_POLL_MS : false,
  })
}
