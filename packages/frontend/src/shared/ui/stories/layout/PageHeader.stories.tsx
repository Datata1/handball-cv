import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@/components/ui/button'

import { PageHeader } from '../../layout/PageHeader'

const meta = {
  title: 'Kit/Layout/PageHeader',
  component: PageHeader,
  parameters: { layout: 'padded' },
  args: { title: 'TSV Hannover-Burgdorf – SC Magdeburg' },
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const TitleOnly: Story = {}

export const WithDescription: Story = {
  args: { description: '2. Halbzeit · 1080p · 25 fps' },
}

export const WithActions: Story = {
  args: {
    description: '2. Halbzeit · 1080p · 25 fps',
    actions: (
      <>
        <Button variant="outline" size="sm">
          Umbenennen
        </Button>
        <Button variant="destructive" size="sm">
          Löschen
        </Button>
      </>
    ),
  },
}

/** Long titles wrap rather than pushing the actions off the row. */
export const LongTitle: Story = {
  args: {
    title:
      'HSG Nordhorn-Lingen gegen die Rhein-Neckar Löwen, Aufzeichnung vom 14. März',
    actions: (
      <Button variant="outline" size="sm">
        Umbenennen
      </Button>
    ),
  },
}
