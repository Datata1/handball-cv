import type { Meta, StoryObj } from '@storybook/react-vite'

import { LoadingState } from '../../state/LoadingState'

const meta = {
  title: 'Kit/State/LoadingState',
  component: LoadingState,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof LoadingState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SingleLine: Story = {
  args: { lines: 1 },
}

export const List: Story = {
  args: { lines: 6, label: 'Spiele werden geladen…' },
}
