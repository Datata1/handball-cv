import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
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

/**
 * Click to edit. Saving is deliberate — Enter or the check — while Escape, the
 * cross and clicking away all discard.
 */
export const Default: Story = {}

/** No value yet — the placeholder is not a value, and reads as one. */
export const Unset: Story = {
  args: { value: '', placeholder: 'Mannschaft eintragen' },
}

/** The input is sized to the draft, so opening it does not shove the row sideways. */
export const LongValue: Story = {
  args: { value: 'HSG Nordhorn-Lingen Handball Spielgemeinschaft' },
}

/** The save is in flight. The trigger stays focusable so Enter does not strand focus. */
export const Pending: Story = {
  args: { pending: true },
}

export const Failed: Story = {
  args: { error: 'Der Name konnte nicht gespeichert werden.' },
}

/**
 * A save that fails. The caller rolls its value back, so the field reopens on
 * the text that failed rather than making the user type it again.
 */
export const SaveFails: Story = {
  render: (args) => <FailingField {...args} />,
}

function FailingField(args: ComponentProps<typeof EditableField>) {
  const [error, setError] = useState<string>()

  return (
    <EditableField
      {...args}
      error={error}
      onSave={() => setError('Der Name konnte nicht gespeichert werden.')}
    />
  )
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
