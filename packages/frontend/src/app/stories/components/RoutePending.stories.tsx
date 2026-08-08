import type { Meta, StoryObj } from '@storybook/react-vite'

import { RoutePending } from '../../components/RoutePending'

const meta = {
  title: 'App/RoutePending',
  component: RoutePending,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof RoutePending>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
