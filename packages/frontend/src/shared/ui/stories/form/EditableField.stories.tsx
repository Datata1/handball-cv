import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { EditableField } from '../../form/EditableField'

const meta = {
  title: 'Kit/Form/EditableField',
  component: EditableField,
  parameters: { layout: 'padded' },
  args: {
    label: 'Heimmannschaft',
    value: 'TSV Hannover-Burgdorf',
    onSave: fn(),
  },
} satisfies Meta<typeof EditableField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** No value yet — the placeholder is not a value, and reads as one. */
export const Unset: Story = {
  args: { value: '', placeholder: 'Mannschaft eintragen' },
}

/** The save is in flight. The trigger stays focusable so Enter does not strand focus. */
export const Pending: Story = {
  args: { pending: true },
}

export const Failed: Story = {
  args: { error: 'Der Name konnte nicht gespeichert werden.' },
}

/** On the navy chrome, where the report header puts it. */
export const OnChrome: Story = {
  args: { tone: 'dark' },
  render: (args) => (
    <div className="rounded-md bg-chrome px-4 py-3 text-chrome-foreground">
      <EditableField {...args} />
    </div>
  ),
}
