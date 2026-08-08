import type { Meta, StoryObj } from '@storybook/react-vite'
import { Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { EmptyState } from '../../state/EmptyState'

const meta = {
  title: 'Kit/State/EmptyState',
  component: EmptyState,
  parameters: { layout: 'padded' },
  args: { title: 'Noch keine Spiele' },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const TitleOnly: Story = {}

export const WithIconAndDescription: Story = {
  args: {
    icon: <Inbox />,
    description: 'Lade eine Aufzeichnung hoch, um die erste Auswertung zu starten.',
  },
}

export const WithAction: Story = {
  args: {
    icon: <Inbox />,
    description: 'Lade eine Aufzeichnung hoch, um die erste Auswertung zu starten.',
    action: <Button size="sm">Video hochladen</Button>,
  },
}
