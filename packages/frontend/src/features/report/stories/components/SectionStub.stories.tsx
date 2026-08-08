import type { Meta, StoryObj } from '@storybook/react-vite'

import { SectionStub } from '../../components/SectionStub'

const meta = {
  title: 'Report/SectionStub',
  component: SectionStub,
  parameters: { layout: 'padded' },
  args: { title: 'Abwehr' },
} satisfies Meta<typeof SectionStub>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
