import type { Meta, StoryObj } from '@storybook/react-vite'

import { TrackTable } from '../../components/TrackTable'
import { DEFAULT_TRACK_SORT } from '../../tracks'
import { extremeTracksStats, teamName, tracks } from '../players'

const meta = {
  title: 'Players/TrackTable',
  component: TrackTable,
  parameters: { layout: 'padded' },
  args: {
    tracks,
    sort: DEFAULT_TRACK_SORT,
    onSort: () => {},
    teamName,
  },
} satisfies Meta<typeof TrackTable>

export default meta
type Story = StoryObj<typeof meta>

/** All 25 rows the endpoint can return, in the order it returns them. */
export const Default: Story = {}

export const FewRows: Story = {
  args: { tracks: tracks.slice(0, 3) },
}

export const SortedByDistance: Story = {
  args: { sort: { key: 'distance', direction: 'ascending' } },
}

/** Two seconds of one track, and one that runs the length of the match. */
export const ExtremeValues: Story = {
  args: { tracks: extremeTracksStats.player_stats },
}

/** A filter that matched nothing — the columns stay, so the filter can be undone. */
export const NoRowsInFilter: Story = {
  args: { tracks: [], empty: 'Für diese Auswahl wurde kein Track gespeichert.' },
}
