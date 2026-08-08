import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'

import { AppHeader } from '@/shared/ui'
import { withRouter } from '@/testing/router'

import { MainNav } from '../../components/MainNav'

// The nav is white-on-navy, so it is only legible — and only contrast-checkable
// — inside the bar it ships in.
const inHeader: Decorator = (Story) => (
  <AppHeader>
    <Story />
  </AppHeader>
)

const meta = {
  title: 'App/MainNav',
  component: MainNav,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MainNav>

export default meta
type Story = StoryObj<typeof meta>

// The router decorator has to sit outside AppHeader, which links the mark home,
// so both are per-story: a story-level decorator is the innermost one.
export const DashboardActive: Story = {
  decorators: [inHeader, withRouter('/')],
}

export const UploadActive: Story = {
  decorators: [inHeader, withRouter('/upload')],
}

/** Neither link is current — "/" must not match every URL in the app. */
export const InsideAReport: Story = {
  decorators: [inHeader, withRouter('/matches/abc123/overview')],
}
