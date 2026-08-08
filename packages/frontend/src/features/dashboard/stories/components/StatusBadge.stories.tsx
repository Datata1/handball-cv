import type { Meta, StoryObj } from '@storybook/react-vite'

import { StatusBadge } from '../../components/StatusBadge'

const meta = {
  title: 'Dashboard/StatusBadge',
  component: StatusBadge,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Done: Story = { args: { status: 'done' } }
export const Processing: Story = { args: { status: 'processing' } }
export const Failed: Story = { args: { status: 'failed' } }

/** A status file the backend could not read. It is still a match, not an error. */
export const Unknown: Story = { args: { status: 'unknown' } }
