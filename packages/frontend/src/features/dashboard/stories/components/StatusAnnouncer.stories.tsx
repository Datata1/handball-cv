import type { Meta, StoryObj } from '@storybook/react-vite'

import { StatusAnnouncer } from '../../components/StatusAnnouncer'
import { done, failed, processing } from '../matches'

/**
 * Renders nothing visible: it exists so a status arriving over SSE is heard as
 * well as repainted. What it says is asserted in its test, which re-renders it
 * with a changed list — a single render is by definition not news.
 */
const meta = {
  title: 'Dashboard/StatusAnnouncer',
  component: StatusAnnouncer,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StatusAnnouncer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { matches: [done, processing, failed] },
}

/** The list has not arrived yet, so there is nothing to compare against. */
export const Loading: Story = {
  args: { matches: undefined },
}
