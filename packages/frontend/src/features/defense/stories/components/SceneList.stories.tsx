import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ApiError } from '@/shared/api'

import { SceneList } from '../../components/SceneList'
import { scenesFor } from '../../formations'
import { scenes } from '../defense'

const sixNil = scenesFor(scenes, { team: 'A', formation: '6-0' })

const meta = {
  title: 'Defense/SceneList',
  component: SceneList,
  parameters: { layout: 'padded' },
  args: { scenes: sixNil, selectedId: null, onSelect: fn() },
} satisfies Meta<typeof SceneList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The scene the player is clipped to, and the way to release the clip. */
export const Selected: Story = {
  args: { selectedId: 5 },
}

/**
 * The formation was classified frame by frame, but no uninterrupted run of it
 * was stored — an answered request, not a missing one.
 */
export const NoScenes: Story = {
  args: { scenes: [] },
}

export const Loading: Story = {
  args: { scenes: undefined },
}

export const Failed: Story = {
  args: {
    scenes: undefined,
    error: new ApiError(
      500,
      'Internal Server Error',
      '/matches/seed01/formation-scenes',
    ),
    onRetry: fn(),
  },
}
