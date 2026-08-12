import type { Meta, StoryObj } from '@storybook/react-vite'

import { PossessionBar } from '../../components/PossessionBar'
import { possessionSplit } from '../../figures'
import { stats, teamName, wholePossessionStats } from '../overview'

const meta = {
  title: 'Overview/PossessionBar',
  component: PossessionBar,
  args: { possession: possessionSplit(stats), teamName },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PossessionBar>

export default meta
type Story = StoryObj<typeof meta>

/** 54,3 % against 41,2 %: the missing 4,5 % held by nobody the classifier placed. */
export const Default: Story = {}

export const FullyAssigned: Story = {
  args: { possession: possessionSplit(wholePossessionStats) },
}

/** Not one frame had a ball holder, which is what `0 / 0` from `/stats` means. */
export const NotMeasured: Story = {
  args: { possession: null },
}
