import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { GoalList } from '../../components/GoalList'
import { goals } from '../overview'

const meta = {
  title: 'Overview/GoalList',
  component: GoalList,
  args: { goals, onSelect: fn() },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof GoalList>

export default meta
type Story = StoryObj<typeof meta>

/** Eight goals, one of them read without a clock. */
export const Default: Story = {}

export const OneGoal: Story = {
  args: { goals: goals.slice(0, 1) },
}

/** A match the scoreboard was read for, in which nobody scored. */
export const NoGoals: Story = {
  args: { goals: [] },
}
