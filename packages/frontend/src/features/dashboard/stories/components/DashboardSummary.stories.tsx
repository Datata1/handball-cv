import type { Meta, StoryObj } from '@storybook/react-vite'

import { DashboardSummary } from '../../components/DashboardSummary'

const meta = {
  title: 'Dashboard/DashboardSummary',
  component: DashboardSummary,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DashboardSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Measured: Story = {
  args: {
    summary: { total: 12, videoMinutes: 738, lastAnalysis: '2026-08-07T23:32:40' },
  },
}

/** Only in-flight matches: nothing has a duration or an ingest date yet. */
export const NothingMeasured: Story = {
  args: { summary: { total: 1, videoMinutes: null, lastAnalysis: null } },
}

export const NoMatches: Story = {
  args: { summary: { total: 0, videoMinutes: null, lastAnalysis: null } },
}
