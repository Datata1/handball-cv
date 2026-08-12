import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { DURATION_S } from '@/features/report/stories/report'

import { TimeWindow } from '../../components/TimeWindow'

const meta = {
  title: 'Heatmap/TimeWindow',
  component: TimeWindow,
  parameters: { layout: 'padded' },
  args: {
    bounds: { start: 0, end: DURATION_S },
    from: undefined,
    to: undefined,
    onChange: fn(),
  },
} satisfies Meta<typeof TimeWindow>

export default meta
type Story = StoryObj<typeof meta>

/** No window set: both ends sit on the match, and there is nothing to reset. */
export const Default: Story = {}

export const Windowed: Story = {
  args: { from: 300, to: 900 },
}

/** A phase is selected, so "the whole thing" is that phase rather than the match. */
export const WithinPhase: Story = {
  args: { bounds: { start: 120, end: 141 }, from: 125, to: 138 },
}
