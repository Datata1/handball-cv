import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ApiError } from '@/shared/api'

import { MatchFigures } from '../../components/MatchFigures'
import { noPossessionStats, stats, teamName, unmeasuredStats } from '../overview'

const meta = {
  title: 'Overview/MatchFigures',
  component: MatchFigures,
  args: { stats, teamName },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MatchFigures>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoPossession: Story = {
  args: { stats: noPossessionStats },
}

/** Every figure a zero the backend divided by no frames — none of them shown. */
export const Unmeasured: Story = {
  args: { stats: unmeasuredStats },
}

export const Loading: Story = {
  args: { stats: undefined },
}

export const Failed: Story = {
  args: {
    stats: undefined,
    error: new ApiError(500, 'Internal Server Error', '/matches/seed01/stats'),
    onRetry: fn(),
  },
}

/** Mid-ingestion, where a 404 means the reads are frozen rather than empty. */
export const Frozen: Story = {
  args: {
    stats: undefined,
    error: new ApiError(404, 'Match not found', '/matches/seed01/stats'),
    frozen: true,
    onRetry: fn(),
  },
}
