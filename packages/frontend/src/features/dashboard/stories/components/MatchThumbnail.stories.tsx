import type { Meta, StoryObj } from '@storybook/react-vite'

import { MatchThumbnail } from '../../components/MatchThumbnail'
import { brokenThumbnailSrc, thumbnailSrc } from '../matches'

const meta = {
  title: 'Dashboard/MatchThumbnail',
  component: MatchThumbnail,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MatchThumbnail>

export default meta
type Story = StoryObj<typeof meta>

export const Loaded: Story = { args: { src: thumbnailSrc } }

/** Not `done` yet, so there is no frame 42 to decode. */
export const Absent: Story = { args: { src: null } }

/** The endpoint 500s on a video shorter than 43 frames, among other reasons. */
export const Unreachable: Story = { args: { src: brokenThumbnailSrc } }
