import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ApiError } from '@/shared/api'

import { ScoreboardPanel } from '../../components/ScoreboardPanel'
import {
  blowoutSummary,
  noFinalScoreSummary,
  noGoalsSummary,
  summary,
} from '../overview'

const meta = {
  title: 'Overview/ScoreboardPanel',
  component: ScoreboardPanel,
  args: { summary, onSelectGoal: fn() },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ScoreboardPanel>

export default meta
type Story = StoryObj<typeof meta>

/** Final score, the clock it was read at, and the goals that led to it. */
export const Default: Story = {}

export const Blowout: Story = {
  args: { summary: blowoutSummary },
}

/** Readings exist, but never one carrying both scores. */
export const NoFinalScore: Story = {
  args: { summary: noFinalScoreSummary },
}

export const NoGoals: Story = {
  args: { summary: noGoalsSummary },
}

/** The 404 this endpoint answers with for a match it has no readings for. */
export const NoScoreboard: Story = {
  args: { summary: null },
}

export const Loading: Story = {
  args: { summary: undefined },
}

/** A 404 while a match is processing is the read freeze, not an absence. */
export const Frozen: Story = {
  args: {
    summary: undefined,
    error: new ApiError(
      404,
      'No scoreboard readings for this match',
      '/matches/seed01/scoreboard/summary',
    ),
    frozen: true,
    onRetry: fn(),
  },
}
