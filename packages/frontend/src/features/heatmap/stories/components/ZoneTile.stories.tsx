import type { Meta, StoryObj } from '@storybook/react-vite'

import { ZoneTile } from '../../components/ZoneTile'
import { zoneTiles } from '../../tiles'
import { stats, teamName } from '../heatmap'

const [busiest, , , , , quietest] = zoneTiles(stats, 'left')

const meta = {
  title: 'Heatmap/ZoneTile',
  component: ZoneTile,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <ul className="w-56">
        <Story />
      </ul>
    ),
  ],
  args: { tile: busiest, label: 'Linksaußen', teamName },
} satisfies Meta<typeof ZoneTile>

export default meta
type Story = StoryObj<typeof meta>

/** The busiest zone of its half, and almost entirely one team's. */
export const Dominant: Story = {}

/** Below the flip, so the value keeps the card's own foreground. */
export const Quiet: Story = {
  args: { tile: quietest, label: 'Kreisläufer' },
}

export const Balanced: Story = {
  args: {
    tile: {
      zone: 'RM',
      intensity: 62,
      counts: { A: 900, B: 880, U: 240 },
      total: 2_020,
    },
    label: 'Rückraum Mitte',
  },
}

/** The zone was in the response and nobody was ever seen in it. */
export const Silent: Story = {
  args: {
    tile: { zone: 'RR', intensity: 0, counts: { A: 0, B: 0, U: 0 }, total: 0 },
    label: 'Rückraum rechts',
  },
}
