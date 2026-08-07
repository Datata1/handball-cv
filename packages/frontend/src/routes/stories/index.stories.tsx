import type { Meta, StoryObj } from '@storybook/react-vite'

import { Home } from '../index'

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
