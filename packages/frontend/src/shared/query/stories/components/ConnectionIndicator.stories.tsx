import type { Meta, StoryObj } from '@storybook/react-vite'

import { ConnectionIndicator } from '../../components/ConnectionIndicator'

const meta = {
  title: 'Shared/ConnectionIndicator',
  component: ConnectionIndicator,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ConnectionIndicator>

export default meta
type Story = StoryObj<typeof meta>

/** The stream is down. The only state that renders anything. */
export const Interrupted: Story = {
  args: { state: 'interrupted' },
}

/** Healthy. A permanent green light would train people to ignore the red one. */
export const Live: Story = {
  args: { state: 'live' },
}

/** The first few milliseconds after load — silent, so it cannot cry wolf. */
export const Connecting: Story = {
  args: { state: 'connecting' },
}

/** In the shell it sits in the navy header and inherits its text colour. */
export const InHeader: Story = {
  args: { state: 'interrupted' },
  render: (args) => (
    <div className="flex w-96 items-center gap-6 rounded-md bg-wels-navy px-4 py-3 text-white">
      <span className="font-bold">WELS</span>
      <ConnectionIndicator {...args} className="ms-auto" />
    </div>
  ),
}
