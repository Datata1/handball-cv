import type { Meta, StoryObj } from '@storybook/react-vite'

import { TeamFilter } from '../../components/TeamFilter'
import { teamName } from '../players'

const meta = {
  title: 'Players/TeamFilter',
  component: TeamFilter,
  parameters: { layout: 'padded' },
  args: {
    teams: ['A', 'B', 'U'],
    selected: undefined,
    onSelect: () => {},
    teamName,
  },
} satisfies Meta<typeof TeamFilter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const TeamSelected: Story = {
  args: { selected: 'B' },
}

/** Every track unplaced: the only bucket is the one for tracks without a team. */
export const OnlyUnassigned: Story = {
  args: { teams: ['U'] },
}

/** A team id the classifier invented keeps its own entry rather than vanishing. */
export const UnknownTeamId: Story = {
  args: { teams: ['A', 'B', 'C', 'U'] },
}

/** `?team=` for a bucket no track carries — the filter still shows what it is. */
export const SelectedTeamAbsent: Story = {
  args: { selected: 'C' },
}
