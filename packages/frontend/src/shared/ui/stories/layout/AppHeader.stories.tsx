import type { Meta, StoryObj } from '@storybook/react-vite'

import { LiveConnectionIndicator } from '@/shared/query'
import { withRouter } from '@/testing/router'

import { AppHeader } from '../../layout/AppHeader'

const meta = {
  title: 'Kit/Layout/AppHeader',
  component: AppHeader,
  parameters: { layout: 'fullscreen' },
  decorators: [withRouter()],
} satisfies Meta<typeof AppHeader>

export default meta
type Story = StoryObj<typeof meta>

/** The mark alone — the nav slot is empty until routes exist. */
export const Default: Story = {}

/** As mounted by `__root.tsx`. */
export const WithConnectionIndicator: Story = {
  args: {
    children: <LiveConnectionIndicator className="ms-auto" />,
  },
}
