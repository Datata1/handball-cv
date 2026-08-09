import type { Meta, StoryObj } from '@storybook/react-vite'

import { withStores } from '@/testing/stores'

import { ActivePhaseBadge } from '../../components/ActivePhaseBadge'
import { DURATION_S, phases, teamName } from '../report'

/** Puts the playhead somewhere, the way a loaded video would. */
function at(seconds: number) {
  return withStores((store) => {
    store.player.setDuration(DURATION_S)
    store.player.seek(seconds)
    store.player.clearSeek()
  })
}

const meta = {
  title: 'Report/ActivePhaseBadge',
  component: ActivePhaseBadge,
  args: { phases, teamName },
  parameters: { layout: 'padded' },
  decorators: [at(130)],
} satisfies Meta<typeof ActivePhaseBadge>

export default meta
type Story = StoryObj<typeof meta>

/** Inside a phase: who is attacking and who is defending it. */
export const InPhase: Story = {}

export const OtherTeamAttacking: Story = {
  decorators: [at(390)],
}

/** Between two phases — nobody has settled into an attack. */
export const BetweenPhases: Story = {
  decorators: [at(300)],
}

/** Scoring has not run, so there is nothing to say and nothing is drawn. */
export const NoPhases: Story = {
  args: { phases: [] },
}
