import type { Meta, StoryObj } from '@storybook/react-vite'

import { withRouter } from '@/testing/router'

import { SectionNav } from '../../components/SectionNav'

const meta = {
  title: 'Report/SectionNav',
  component: SectionNav,
  parameters: { layout: 'padded' },
  args: { matchId: 'abc123' },
} satisfies Meta<typeof SectionNav>

export default meta
type Story = StoryObj<typeof meta>

export const OverviewActive: Story = {
  decorators: [withRouter('/matches/abc123/overview')],
}

export const HeatmapActive: Story = {
  decorators: [withRouter('/matches/abc123/heatmap')],
}

/** A section filter in the URL must not stop its tab reading as current. */
export const FilteredSection: Story = {
  decorators: [withRouter('/matches/abc123/defense?formation=6-0')],
}
