import type { FormationScene, FormationSummary } from '@/shared/api'

/**
 * `formation-summary` as a table, without ever naming a formation.
 *
 * The label set is an open `dict[str, int]` and is moving from rule-based
 * thresholds to a GCN + LSTM classifier, so nothing in this module may enumerate
 * formations, colour them, or order them by a list of its own. Counts decide the
 * order and the backend's own string is the label.
 */

/**
 * Labels the classifier writes into the formation column that are not
 * formations — they describe what the team was doing, not how it stood.
 *
 * They dominate the counts (a team is attacking for roughly half the match), so
 * leaving them in would put "attack" at the top of a table of defensive shapes.
 * This is an explicit exclusion list rather than a rule, because the only thing
 * that makes these three special is that today's classifier emits them; revisit
 * it when the GCN + LSTM labels land.
 */
export const NON_FORMATION_LABELS: readonly string[] = [
  'attack',
  'transition',
  'unknown',
]

export interface FormationRow {
  formation: string
  /** Frames classified as this formation. */
  count: number
  /** Of the team's classified formation frames, `0`–`1`. */
  share: number
  /** The team's most-used formation, decided over these rows only. */
  dominant: boolean
}

export interface TeamFormations {
  team: string
  rows: FormationRow[]
  /** Frames behind the shares — the sum of `rows`, not of the raw response. */
  total: number
}

function isFormation(label: string): boolean {
  return !NON_FORMATION_LABELS.includes(label.trim().toLowerCase())
}

/**
 * One team's formations, most-used first.
 *
 * `dominant` is recomputed rather than taken from the response: the backend
 * picks it over every label including the phase labels excluded above, so for
 * most matches it answers "attack".
 */
export function formationRows(summary: FormationSummary): FormationRow[] {
  const entries = Object.entries(summary.formations).filter(([formation, count]) => {
    return isFormation(formation) && count > 0
  })

  const total = entries.reduce((sum, [, count]) => sum + count, 0)

  // Ties break on the label so one response always renders in one order:
  // `Object.entries` follows insertion order, which here is frame order.
  const ordered = entries.sort(([labelA, a], [labelB, b]) => {
    return b - a || (labelA < labelB ? -1 : 1)
  })

  return ordered.map(([formation, count], index) => ({
    formation,
    count,
    share: total > 0 ? count / total : 0,
    dominant: index === 0,
  }))
}

/** Every team the summary covers, in a stable order. */
export function formationTable(
  summaries: readonly FormationSummary[],
): TeamFormations[] {
  return [...summaries]
    .sort((a, b) => (a.team < b.team ? -1 : a.team > b.team ? 1 : 0))
    .map((summary) => {
      const rows = formationRows(summary)

      return {
        team: summary.team,
        rows,
        total: rows.reduce((sum, row) => sum + row.count, 0),
      }
    })
}

/** Whether any team had a formation left after the exclusions. */
export function hasFormations(teams: readonly TeamFormations[]): boolean {
  return teams.some((team) => team.rows.length > 0)
}

/**
 * The scenes a drill-in shows, oldest first.
 *
 * Filtered here rather than by the endpoint's `?team&formation`: the shell has
 * already loaded every scene for the timeline, and a filtered request would be a
 * second cache entry describing rows the first one already holds.
 */
export function scenesFor(
  scenes: readonly FormationScene[],
  filter: { team?: string; formation?: string },
): FormationScene[] {
  return scenes
    .filter((scene) => {
      if (filter.team !== undefined && scene.team !== filter.team) return false

      return filter.formation === undefined || scene.formation === filter.formation
    })
    .sort((a, b) => a.start_time_s - b.start_time_s)
}

export function sceneDuration(scene: FormationScene): number {
  return Math.max(0, scene.end_time_s - scene.start_time_s)
}
