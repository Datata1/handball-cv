import type { FormationScene, FormationSummary } from '@/shared/api'

/**
 * `formation-summary` and `formation-scenes` as the backend writes them.
 *
 * Deliberately not a clean set of three well-known formations: the counts
 * include the phase labels the classifier mixes into the same column, and one
 * label — `3-2-1` — is in no frontend dictionary. Both are what these views have
 * to survive.
 */

export const summary: FormationSummary[] = [
  {
    team: 'A',
    formations: {
      attack: 31_500,
      '6-0': 18_000,
      '5-1': 7_200,
      '3-2-1': 2_400,
      transition: 4_100,
      unknown: 900,
    },
    // The backend picks this over every label, phase labels included.
    dominant: 'attack',
  },
  {
    team: 'B',
    formations: {
      attack: 29_000,
      '5-1': 21_600,
      '6-0': 3_600,
      transition: 3_800,
    },
    dominant: 'attack',
  },
]

/** One team, one shape — the smallest thing the table has to render. */
export const singleFormationSummary: FormationSummary[] = [
  { team: 'A', formations: { '6-0': 12_000, attack: 20_000 }, dominant: 'attack' },
]

/**
 * A label set from a model that has not been written yet. Nothing may hardcode
 * a formation, so these have to render exactly like `6-0` does.
 */
export const novelFormationSummary: FormationSummary[] = [
  {
    team: 'A',
    formations: { 'gcn-cluster-7': 9_000, '4-2-flex': 4_500, attack: 15_000 },
    dominant: 'attack',
  },
]

/** Only phase labels: nothing about how anybody stood. */
export const phaseOnlySummary: FormationSummary[] = [
  { team: 'A', formations: { attack: 30_000, transition: 5_000 }, dominant: 'attack' },
  { team: 'B', formations: { attack: 28_000, unknown: 2_000 }, dominant: 'attack' },
]

export const scenes: FormationScene[] = [
  {
    scene_id: 4,
    team: 'A',
    formation: '6-0',
    start_frame: 3_000,
    end_frame: 6_750,
    start_time_s: 120,
    end_time_s: 270,
  },
  {
    scene_id: 5,
    team: 'A',
    formation: '6-0',
    start_frame: 20_000,
    end_frame: 22_100,
    start_time_s: 800,
    end_time_s: 884,
  },
  {
    scene_id: 6,
    team: 'A',
    formation: '5-1',
    start_frame: 30_000,
    end_frame: 33_000,
    start_time_s: 1_200,
    end_time_s: 1_320,
  },
  {
    scene_id: 7,
    team: 'B',
    formation: '5-1',
    start_frame: 40_000,
    end_frame: 45_500,
    start_time_s: 1_600,
    end_time_s: 1_820,
  },
]

const TEAM_NAMES: Record<string, string> = { A: 'HSG Nord', B: 'TV Süd' }

/** Names the teams the way the shell does, without an i18n lookup. */
export const teamName = (team: string): string => TEAM_NAMES[team.toUpperCase()] ?? team

/** `useBackendLabel()` for the two groups these views look up. */
export const label = (group: string, value: string): string => {
  const known: Record<string, string> = { A: 'HSG Nord', B: 'TV Süd' }

  return group === 'team' ? (known[value] ?? value) : value
}
