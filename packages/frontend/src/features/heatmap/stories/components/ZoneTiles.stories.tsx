import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ApiError } from '@/shared/api'

import { ZoneTiles } from '../../components/ZoneTiles'
import { label, stats, teamName, unmeasuredStats } from '../heatmap'

const meta = {
  title: 'Heatmap/ZoneTiles',
  component: ZoneTiles,
  parameters: { layout: 'padded' },
  args: { stats, label, teamName, onRetry: fn() },
} satisfies Meta<typeof ZoneTiles>

export default meta
type Story = StoryObj<typeof meta>

/** Both halves, with a strong team split in the wings. */
export const Default: Story = {}

/** The endpoint answered and every zone in it is a zero. */
export const NothingMeasured: Story = {
  args: { stats: unmeasuredStats },
}

export const Loading: Story = {
  args: { stats: undefined },
}

export const Failed: Story = {
  args: { stats: undefined, error: new ApiError(500, 'boom', '/stats') },
}

/** The same 404, while every read is frozen — it says nothing about this match. */
export const Frozen: Story = {
  args: {
    stats: undefined,
    error: new ApiError(404, 'Match not found', '/stats'),
    frozen: true,
  },
}
