import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TeamFormationList } from '../../components/TeamFormationList'
import { formationTable } from '../../formations'
import { label, phaseOnlySummary, summary, teamName } from '../defense'

const [teamA] = formationTable(summary)
const [emptyTeam] = formationTable(phaseOnlySummary)

const meta = {
  title: 'Defense/TeamFormationList',
  component: TeamFormationList,
  parameters: { layout: 'padded' },
  args: {
    team: teamA,
    teamName,
    label,
    selected: undefined,
    onSelect: fn(),
  },
} satisfies Meta<typeof TeamFormationList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Selected: Story = {
  args: { selected: '6-0' },
}

/** Every label this team carried was a phase label. */
export const NoFormations: Story = {
  args: { team: emptyTeam },
}
