import type { Meta, StoryObj } from '@storybook/react-vite'

import { withRouter } from '@/testing/router'

import { RouteNotFound } from '../../components/RouteNotFound'

const meta = {
  title: 'App/RouteNotFound',
  component: RouteNotFound,
  parameters: { layout: 'padded' },
  decorators: [withRouter('/kein-pfad')],
} satisfies Meta<typeof RouteNotFound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
