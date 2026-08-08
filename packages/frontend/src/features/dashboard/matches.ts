import type { MatchMeta } from '@/shared/api'

import type { SortKey } from './search'

/**
 * Everything the dashboard derives from the match list, as pure functions over
 * `MatchMeta` — there is no server-side search, sort or pagination anywhere in
 * this API, so all of it happens over the already-fetched list.
 *
 * Every field read here is nullable or degenerate on an in-flight match:
 * `GET /matches` appends a row with `file_name: ""`, `fps: 0` and every
 * nullable column `null` for anything that has a status file but no DuckDB row.
 */

/** What the card shows and what a name sort orders by. Never empty. */
export function matchTitle(match: MatchMeta): string {
  return match.display_name?.trim() || match.file_name || match.match_id
}

export function filterMatches(
  matches: readonly MatchMeta[],
  query: string | undefined,
): MatchMeta[] {
  const needle = query?.trim().toLocaleLowerCase() ?? ''
  if (needle === '') return [...matches]

  return matches.filter((match) =>
    [match.display_name, match.file_name, match.team_a_name, match.team_b_name].some(
      (field) => field?.toLocaleLowerCase().includes(needle),
    ),
  )
}

export function sortMatches(
  matches: readonly MatchMeta[],
  sort: SortKey,
  locale?: string,
): MatchMeta[] {
  const sorted = [...matches]

  if (sort === 'name') {
    return sorted.sort((a, b) => matchTitle(a).localeCompare(matchTitle(b), locale))
  }

  // A match with no `ingested_at` is one that has not finished ingesting, so it
  // is the most recent thing that happened rather than the oldest.
  return sorted.sort((a, b) => ingestedAt(b) - ingestedAt(a))
}

function ingestedAt(match: MatchMeta): number {
  if (!match.ingested_at) return Number.POSITIVE_INFINITY

  const parsed = Date.parse(match.ingested_at)
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

export interface MatchListSummary {
  total: number
  /** Sum of every known duration, in minutes. `null` when none is known. */
  videoMinutes: number | null
  /** The most recent `ingested_at`, ISO. `null` when nothing has finished. */
  lastAnalysis: string | null
}

export function summariseMatches(matches: readonly MatchMeta[]): MatchListSummary {
  let seconds = 0
  let measured = false
  let lastAnalysis: string | null = null
  let lastAt = Number.NEGATIVE_INFINITY

  for (const match of matches) {
    const duration = parseDuration(match.duration)
    if (duration !== null) {
      seconds += duration
      measured = true
    }

    if (!match.ingested_at) continue
    const at = Date.parse(match.ingested_at)
    if (!Number.isNaN(at) && at > lastAt) {
      lastAt = at
      lastAnalysis = match.ingested_at
    }
  }

  return {
    total: matches.length,
    videoMinutes: measured ? Math.round(seconds / 60) : null,
    lastAnalysis,
  }
}

/**
 * `duration` is `"MM:SS"`, built server-side from `total_frames / fps` — the
 * minutes are not wrapped at 60, so a 72-minute match is `"72:15"`.
 */
export function parseDuration(duration: string | null): number | null {
  if (!duration) return null

  const [minutes, seconds] = duration.split(':')
  const parsed = Number(minutes) * 60 + Number(seconds)

  return Number.isFinite(parsed) && seconds !== undefined ? parsed : null
}

export function formatDate(iso: string | null, locale?: string): string | null {
  if (!iso) return null

  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null

  return at.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
