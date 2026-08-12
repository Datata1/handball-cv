import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ApiError } from '@/shared/api'

import { PlaySceneList } from '../../components/PlaySceneList'
import { playsFor } from '../../plays'
import { label, plays, teamName } from '../offense'

const crossings = playsFor(plays, { playType: 'kreuzen' })

const meta = {
  title: 'Offense/PlaySceneList',
  component: PlaySceneList,
  parameters: { layout: 'padded' },
  args: { plays: crossings, teamName, label, selectedId: null, onSelect: fn() },
} satisfies Meta<typeof PlaySceneList>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Three runs of one play type: one that ended in a goal, one that did not, and
 * one from a database with no attack sequences at all — whose outcome is
 * unknown rather than "kein Tor".
 */
export const Default: Story = {}

/** The scene the player is clipped to, and the way to release the clip. */
export const Selected: Story = {
  args: { selectedId: 13 },
}

/** Counted in the summary, but no single event stored. */
export const NoScenes: Story = {
  args: { plays: [] },
}

/** An empty list mid-ingestion proves nothing — every read is frozen. */
export const Frozen: Story = {
  args: { plays: [], frozen: true },
}

export const Loading: Story = {
  args: { plays: undefined },
}

export const Failed: Story = {
  args: {
    plays: undefined,
    error: new ApiError(500, 'Internal Server Error', '/matches/seed01/plays'),
    onRetry: fn(),
  },
}
