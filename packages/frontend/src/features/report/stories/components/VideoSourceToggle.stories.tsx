import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { VideoSourceToggle } from '../../components/VideoSourceToggle'

const meta = {
  title: 'Report/VideoSourceToggle',
  component: VideoSourceToggle,
  args: { value: 'original', annotated: 'ready', onChange: fn() },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof VideoSourceToggle>

export default meta
type Story = StoryObj<typeof meta>

/** A render exists: both files are one click apart. */
export const Ready: Story = {}

export const OnAnnotated: Story = {
  args: { value: 'annotated' },
}

/** Still being drawn. Disabled rather than hidden, so the option is learnable. */
export const Processing: Story = {
  args: { annotated: 'processing' },
}

/** Uploaded without `annotate_video`: there is nothing to switch to, so no switch. */
export const Absent: Story = {
  args: { annotated: 'absent' },
}
