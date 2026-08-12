import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TrackFilter } from '../../components/TrackFilter'
import { availableTracks, teamName } from '../heatmap'

const meta = {
  title: 'Heatmap/TrackFilter',
  component: TrackFilter,
  parameters: { layout: 'padded' },
  args: {
    tracks: availableTracks,
    selected: undefined,
    onChange: fn(),
    teamName,
  },
} satisfies Meta<typeof TrackFilter>

export default meta
type Story = StoryObj<typeof meta>

/** Nothing ticked, which is how this endpoint says "every player". */
export const Default: Story = {}

export const TwoPicked: Story = {
  args: { selected: [3, 7] },
}

/** More tracks than players: a cut or an occlusion ends one and starts another. */
export const ManyTracks: Story = {
  args: {
    tracks: Array.from({ length: 24 }, (_, index) => ({
      track_id: index + 1,
      team: index % 3 === 2 ? 'unknown' : index % 2 === 0 ? 'A' : 'B',
      first_frame: index * 500,
      last_frame: index * 500 + 12_000,
      frame_count: 12_000 - index * 200,
      first_time_s: index * 20,
      last_time_s: index * 20 + 480,
    })),
    selected: [2, 5],
  },
}

export const Loading: Story = {
  args: { tracks: undefined },
}

/** A window or a perspective narrow enough that no track was on the court. */
export const NoTracks: Story = {
  args: { tracks: [] },
}
