import type { Meta, StoryObj } from '@storybook/react-vite'
import { Page } from '../../layout/Page'
import { PageHeader } from '../../layout/PageHeader'
import { Section } from '../../layout/Section'

const meta = {
  title: 'Kit/Layout/Page',
  component: Page,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Page>

export default meta
type Story = StoryObj<typeof meta>

/** The rhythm a route inherits: header, then sections, evenly spaced. */
export const Default: Story = {
  args: {
    children: (
      <>
        <PageHeader title="Spiele" description="Alle ausgewerteten Begegnungen." />

        <Section title="Zuletzt verarbeitet">
          <p className="text-sm text-muted-foreground">Inhalt der ersten Sektion.</p>
        </Section>

        <Section title="Archiv">
          <p className="text-sm text-muted-foreground">Inhalt der zweiten Sektion.</p>
        </Section>
      </>
    ),
  },
}
