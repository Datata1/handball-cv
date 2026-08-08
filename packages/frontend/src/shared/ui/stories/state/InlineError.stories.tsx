import type { Meta, StoryObj } from '@storybook/react-vite'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { InlineError } from '../../state/InlineError'

const meta = {
  title: 'Kit/State/InlineError',
  component: InlineError,
  parameters: { layout: 'padded' },
  args: { children: 'Der Name konnte nicht gespeichert werden.' },
} satisfies Meta<typeof InlineError>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** In place: wired to the control it describes. */
export const UnderAField: Story = {
  render: (args) => (
    <div className="max-w-sm space-y-1">
      <Label htmlFor="team-a">Heimmannschaft</Label>
      <Input id="team-a" aria-invalid aria-describedby="team-a-error" defaultValue="" />
      <InlineError {...args} id="team-a-error" />
    </div>
  ),
}
