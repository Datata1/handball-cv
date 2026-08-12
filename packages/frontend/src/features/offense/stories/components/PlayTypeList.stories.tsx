import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ApiError } from '@/shared/api'

import { PlayTypeList } from '../../components/PlayTypeList'
import { label, summary, teamName, unratedSummary } from '../offense'

const meta = {
  title: 'Offense/PlayTypeList',
  component: PlayTypeList,
  parameters: { layout: 'padded' },
  args: {
    summary,
    teamName,
    label,
    selected: undefined,
    onSelect: fn(),
  },
} satisfies Meta<typeof PlayTypeList>

export default meta
type Story = StoryObj<typeof meta>

/** Four play types, most-detected first, with both teams folded together. */
export const Default: Story = {}

/**
 * `rueckraumdurchbruch` is in no dictionary and renders under its own name.
 * The legacy section iterated a frontend dictionary of four, so a fifth type
 * rendered nothing at all — this is the one thing this view may never get wrong.
 */
export const NovelPlayType: Story = {
  args: { summary: summary.filter((row) => row.play_type === 'rueckraumdurchbruch') },
}

/** No scoreboard, so no attack outcome: "keine Bewertung", never `0 %`. */
export const NothingRated: Story = {
  args: { summary: unratedSummary },
}

export const DrilledIn: Story = {
  args: { selected: 'kreuzen' },
}

/** Scored, but the detector found nothing. `/play-summary` answers `[]`. */
export const NoPlays: Story = {
  args: { summary: [] },
}

/**
 * The same empty list, mid-ingestion — where `db.py:28` empties every read and
 * it says nothing about whether plays were detected.
 */
export const Frozen: Story = {
  args: { summary: [], frozen: true },
}

export const Loading: Story = {
  args: { summary: undefined },
}

export const Failed: Story = {
  args: {
    summary: undefined,
    error: new ApiError(500, 'Internal Server Error', '/matches/seed01/play-summary'),
    onRetry: fn(),
  },
}
