import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { UploadDropzone } from '../../components/UploadDropzone'

const meta = {
  title: 'Upload/UploadDropzone',
  component: UploadDropzone,
  args: { onSelect: fn() },
} satisfies Meta<typeof UploadDropzone>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** While a file hovers over the zone. */
export const Dragging: Story = { args: { defaultDragging: true } }
