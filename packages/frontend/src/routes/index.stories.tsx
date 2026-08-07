import type { Meta, StoryObj } from '@storybook/react-vite'

import { Home } from './index'

// Stories are the single fixture source for this codebase: the test next to
// this file renders these exact stories via composeStories, so a story and
// its test cannot drift, and the a11y panel and CI assert the same thing.
const meta = {
  title: 'Routes/Home',
  component: Home,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof Home>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
