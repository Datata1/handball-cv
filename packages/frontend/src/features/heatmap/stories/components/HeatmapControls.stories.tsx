import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { HeatmapControls } from '../../components/HeatmapControls'

const meta = {
  title: 'Heatmap/HeatmapControls',
  component: HeatmapControls,
  parameters: { layout: 'padded' },
  args: {
    mode: 'density',
    perspective: 'both',
    phaseLabel: null,
    onModeChange: fn(),
    onPerspectiveChange: fn(),
    onClearPhase: fn(),
  },
} satisfies Meta<typeof HeatmapControls>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const OffenseOnly: Story = {
  args: { perspective: 'offense' },
}

/** A phase picked on the shared timeline; this only reports it and offers a way out. */
export const PhaseSelected: Story = {
  args: { phaseLabel: 'HSG Nord Angriff (02:00–02:21)' },
}

/** The tiles summarise the whole match, so the filters that cannot reach them are gone. */
export const Tiles: Story = {
  args: { mode: 'tiles', perspective: 'offense', phaseLabel: 'HSG Nord Angriff' },
}
