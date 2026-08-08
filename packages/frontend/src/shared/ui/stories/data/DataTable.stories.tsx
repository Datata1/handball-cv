import type { Meta, StoryObj } from '@storybook/react-vite'

import { type Column, DataTable } from '../../data/DataTable'

type Track = {
  id: string
  team: string
  frames: number
  distance: number
}

const columns: Column<Track>[] = [
  { id: 'id', header: 'Track', cell: (track) => track.id },
  { id: 'team', header: 'Mannschaft', cell: (track) => track.team },
  {
    id: 'frames',
    header: 'Frames',
    numeric: true,
    cell: (track) => track.frames.toLocaleString('de-DE'),
  },
  {
    id: 'distance',
    header: 'Distanz (m)',
    numeric: true,
    cell: (track) => track.distance.toLocaleString('de-DE'),
  },
]

const rows: Track[] = [
  { id: '12', team: 'Heim', frames: 41_233, distance: 4182 },
  { id: '19', team: 'Heim', frames: 38_910, distance: 3960 },
  { id: '27', team: 'Gast', frames: 40_004, distance: 4471 },
  { id: '31', team: 'Gast', frames: 12_887, distance: 1204 },
]

// A story-only wrapper: `DataTable` is generic, and Meta<typeof DataTable>
// cannot pin its type parameter.
function TrackTable(props: Omit<Parameters<typeof DataTable<Track>>[0], 'getRowId'>) {
  return <DataTable<Track> {...props} getRowId={(track) => track.id} />
}

const meta = {
  title: 'Kit/Data/DataTable',
  component: TrackTable,
  parameters: { layout: 'padded' },
  args: { caption: 'Erkannte Tracks', columns, rows },
} satisfies Meta<typeof TrackTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The caption still names the table for assistive tech when a heading is above it. */
export const HiddenCaption: Story = {
  args: { captionHidden: true },
}

export const NoRows: Story = {
  args: { rows: [] },
}

export const NoRowsWithOwnMessage: Story = {
  args: { rows: [], empty: 'Für diesen Abschnitt wurde kein Track erkannt.' },
}
