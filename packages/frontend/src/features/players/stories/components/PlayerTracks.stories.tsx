import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ApiError } from '@/shared/api'

import { PlayerTracks } from '../../components/PlayerTracks'
import { DEFAULT_TRACK_SORT } from '../../tracks'
import {
  extremeTracksStats,
  fewTracksStats,
  noTracksStats,
  statsWithTracks,
  teamName,
  unplacedTracksStats,
} from '../players'

const meta = {
  title: 'Players/PlayerTracks',
  component: PlayerTracks,
  parameters: { layout: 'padded' },
  args: {
    stats: statsWithTracks,
    teamName,
    sort: DEFAULT_TRACK_SORT,
    team: undefined,
    onSortChange: () => {},
    onTeamChange: () => {},
  },
} satisfies Meta<typeof PlayerTracks>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FewTracks: Story = {
  args: { stats: fewTracksStats },
}

export const FilteredToOneTeam: Story = {
  args: { team: 'A' },
}

/** `?team=` for a bucket no row carries: the filter is shown, the table is empty. */
export const FilteredToNothing: Story = {
  args: { team: 'C' },
}

export const UnplacedTracks: Story = {
  args: { stats: unplacedTracksStats },
}

export const ExtremeValues: Story = {
  args: { stats: extremeTracksStats },
}

/** The endpoint answered and stored no person — nothing to sort or filter. */
export const NoTracks: Story = {
  args: { stats: noTracksStats },
}

export const Loading: Story = {
  args: { stats: undefined },
}

export const Failed: Story = {
  args: {
    stats: undefined,
    error: new ApiError(500, 'Internal Server Error', '/matches/seed01/stats'),
    onRetry: fn(),
  },
}

/** Mid-ingestion, where a 404 means the reads are frozen rather than empty. */
export const Frozen: Story = {
  args: {
    stats: undefined,
    error: new ApiError(404, 'Match not found', '/matches/seed01/stats'),
    frozen: true,
    onRetry: fn(),
  },
}
