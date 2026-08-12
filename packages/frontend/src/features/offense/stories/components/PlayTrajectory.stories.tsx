import type { Meta, StoryObj } from '@storybook/react-vite'

import { PlayTrajectory } from '../../components/PlayTrajectory'
import { plays } from '../offense'

const meta = {
  title: 'Offense/PlayTrajectory',
  component: PlayTrajectory,
  parameters: { layout: 'padded' },
  args: { play: plays[0], playType: 'Kreuzen', team: 'HSG Nord' },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlayTrajectory>

export default meta
type Story = StoryObj<typeof meta>

/** Two backs crossing in front of the left goal, which is marked as attacked. */
export const Default: Story = {}

/**
 * The fast-break detector stores the team centroid instead of players.
 * `track_id === -1` is a mean over the team, so it is drawn dashed and named as
 * such rather than passed off as somebody's run.
 */
export const Centroid: Story = {
  args: { play: plays[3], playType: 'Tempogegenstoß', team: 'TV Süd' },
}

/** A detector run that stored no trajectories at all. */
export const NoDetails: Story = {
  args: { play: plays[1], playType: 'Kreuzen', team: 'TV Süd' },
}

/** Details in a shape the court cannot draw — the scene keeps its row anyway. */
export const UnusableDetails: Story = {
  args: { play: plays[2] },
}
