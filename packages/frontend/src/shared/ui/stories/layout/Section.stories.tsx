import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@/components/ui/button'

import { Section } from '../../layout/Section'

const meta = {
  title: 'Kit/Layout/Section',
  component: Section,
  parameters: { layout: 'padded' },
  args: {
    title: 'Ballbesitz',
    children: <p className="text-sm text-muted-foreground">Inhalt der Sektion.</p>,
  },
} satisfies Meta<typeof Section>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithDescription: Story = {
  args: { description: 'Anteil der Phasen je Mannschaft.' },
}

export const WithActions: Story = {
  args: {
    actions: (
      <Button variant="ghost" size="sm">
        Alle anzeigen
      </Button>
    ),
  },
}

/** Nested one level deeper, e.g. inside a report section that owns the h2. */
export const AsSubsection: Story = {
  args: { headingLevel: 3, title: 'Angriff' },
}
