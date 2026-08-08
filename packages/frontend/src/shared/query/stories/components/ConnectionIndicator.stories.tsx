import type { Meta, StoryObj } from '@storybook/react-vite'

import { ConnectionIndicator } from '../../components/ConnectionIndicator'

const meta = {
  title: 'Shared/ConnectionIndicator',
  component: ConnectionIndicator,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ConnectionIndicator>

export default meta
type Story = StoryObj<typeof meta>

/** The stream is down — the only state that renders anything. */
export const Interrupted: Story = {
  args: { state: 'interrupted' },
}

export const Live: Story = {
  args: { state: 'live' },
}

export const Connecting: Story = {
  args: { state: 'connecting' },
}

/** In place: it inherits the header's text colour. */
export const InHeader: Story = {
  args: { state: 'interrupted' },
  render: (args) => (
    <div className="flex w-96 items-center gap-6 rounded-md bg-wels-navy px-4 py-3 text-white">
      <span className="font-bold">WELS</span>
      <ConnectionIndicator {...args} className="ms-auto" />
    </div>
  ),
}
