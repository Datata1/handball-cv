import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { DeleteMatchDialog } from '../../components/DeleteMatchDialog'

const meta = {
  title: 'Dashboard/DeleteMatchDialog',
  component: DeleteMatchDialog,
  parameters: { layout: 'centered' },
  args: { title: 'Testspiel Nord vs Süd', onConfirm: fn() },
} satisfies Meta<typeof DeleteMatchDialog>

export default meta
type Story = StoryObj<typeof meta>

/** All the card shows until you ask: one icon button, named after the match. */
export const Default: Story = {}

/**
 * Open. The copy names what goes and what stays — the tracking data in DuckDB
 * survives a delete, and promising otherwise would be a lie.
 */
export const Open: Story = { args: { defaultOpen: true } }

export const LongName: Story = {
  args: {
    defaultOpen: true,
    title: 'Landesliga Nord — 14. Spieltag, Nachholspiel im Sportpark Ost',
  },
}
