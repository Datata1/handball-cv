import type { Meta, StoryObj } from '@storybook/react-vite'

import { DensityMap } from '../../components/DensityMap'
import {
  denseHeatmapPoints,
  emptyHeatmapPoints,
  heatmapPoints,
  label,
  oneTeamHeatmapPoints,
  sparseHeatmapPoints,
  teamName,
} from '../heatmap'

const meta = {
  title: 'Heatmap/DensityMap',
  component: DensityMap,
  parameters: { layout: 'padded' },
  args: { points: heatmapPoints.heatmap_points, teamName, label },
} satisfies Meta<typeof DensityMap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The 12 000 points `/heatmap-points` returns for a whole match, undownsampled. */
export const Dense: Story = {
  args: { points: denseHeatmapPoints.heatmap_points },
}

export const SingleTeam: Story = {
  args: { points: oneTeamHeatmapPoints.heatmap_points },
}

/** Four measurements. The map draws them; `PointSummary` says they are too few. */
export const Sparse: Story = {
  args: { points: sparseHeatmapPoints.heatmap_points },
}

/** Nothing measured, nothing drawn — the legacy view seeded blobs at the zone centres. */
export const Nothing: Story = {
  args: { points: emptyHeatmapPoints.heatmap_points },
}

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}

/** The ramp reads the tokens off the canvas, so it follows the scheme around it. */
export const Dark: Story = {
  decorators: [
    (Story) => (
      <div className="dark bg-background p-4">
        <Story />
      </div>
    ),
  ],
}

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  decorators: [
    (Story) => (
      <div className="mx-auto w-96">
        <Story />
      </div>
    ),
  ],
}
