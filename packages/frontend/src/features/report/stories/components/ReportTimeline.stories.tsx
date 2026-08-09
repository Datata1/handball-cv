import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { withStores } from '@/testing/stores'

import { ReportTimeline } from '../../components/ReportTimeline'
import { buildTimelineTracks } from '../../timeline'
import { DURATION_S, formations, goals, phases, plays, teamName } from '../report'

const labels = {
  tracks: {
    goals: 'Tore',
    phases: 'Ballbesitz',
    plays: 'Spielzüge',
    formations: 'Formationen',
  },
  goal: (goal: (typeof goals)[number]) =>
    `Tor ${goal.team === 'home' ? 'Heim' : 'Gast'}, ${goal.score_home}:${goal.score_away}`,
  phase: (phase: (typeof phases)[number]) => `Angriff: ${teamName(phase.offense_team)}`,
  play: (play: (typeof plays)[number]) => `${play.play_type}, ${teamName(play.team)}`,
  formation: (scene: (typeof formations)[number]) =>
    `${scene.formation}, ${teamName(scene.team)}`,
}

/** What the shell builds from the four endpoints, without an i18n lookup. */
const tracks = buildTimelineTracks({ goals, phases, plays, formations }, labels)

const meta = {
  title: 'Report/ReportTimeline',
  component: ReportTimeline,
  args: { duration: DURATION_S, tracks, selectedId: null, onSelect: fn() },
  parameters: { layout: 'padded' },
  decorators: [
    withStores((store) => {
      store.player.setDuration(DURATION_S)
      store.player.seek(402)
      store.player.clearSeek()
    }),
  ],
} satisfies Meta<typeof ReportTimeline>

export default meta
type Story = StoryObj<typeof meta>

/** All four tracks the shell loads, with the playhead across them. */
export const Default: Story = {}

export const WithSelection: Story = {
  args: { selectedId: 'phase-2' },
}

/**
 * The read freeze emptied the match row, so its length is `0` — the element's
 * own metadata is what the bars are then scaled against.
 */
export const DurationFromVideo: Story = {
  args: { duration: 0 },
}

/**
 * `/scoreboard/summary` 404s for a match whose scoreboard was never read, so
 * there is no goal lane — rather than an empty one saying nobody scored.
 */
export const NoScoreboard: Story = {
  args: { tracks: buildTimelineTracks({ phases, plays, formations }, labels) },
}

/** Nothing scored and nothing detected: no track claims to have looked. */
export const NothingLoaded: Story = {
  args: { tracks: [] },
}
