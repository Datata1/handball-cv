import type { MatchMeta } from '@/shared/api'

export type TeamName = (team: string) => string

/**
 * What to call a team the backend named `"A"` or `"B"`: the trainer's name for
 * it, if they have set one.
 *
 * `fallback` is `useBackendLabel`'s `team` group, so a value the classifier
 * invents — `"unknown"` today, whatever the GCN emits later — still renders as
 * itself rather than disappearing.
 */
export function teamNamer(
  match: Pick<MatchMeta, 'team_a_name' | 'team_b_name'>,
  fallback: TeamName,
): TeamName {
  const named: Record<string, string | null> = {
    A: match.team_a_name,
    B: match.team_b_name,
  }

  return (team) => named[team.toUpperCase()]?.trim() || fallback(team)
}
