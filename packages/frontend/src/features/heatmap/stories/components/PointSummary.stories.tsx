import type { Meta, StoryObj } from '@storybook/react-vite'

import { PointSummary } from '../../components/PointSummary'
import { emptyHeatmapPoints, heatmapPoints, sparseHeatmapPoints } from '../heatmap'

const meta = {
  title: 'Heatmap/PointSummary',
  component: PointSummary,
  parameters: { layout: 'padded' },
  args: { points: heatmapPoints.heatmap_points, filtered: false },
} satisfies Meta<typeof PointSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/**
 * One track over a minute of the match. Positions are stored about four times a
 * second, so a narrow filter can leave a handful behind.
 */
export const Sparse: Story = {
  args: { points: sparseHeatmapPoints.heatmap_points, filtered: true },
}

export const Nothing: Story = {
  args: { points: emptyHeatmapPoints.heatmap_points, filtered: true },
}

export const Loading: Story = {
  args: { points: undefined },
}
