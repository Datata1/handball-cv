import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { UploadProgress } from '../../components/UploadProgress'

const GIGABYTE = 1000 ** 3

const meta = {
  title: 'Upload/UploadProgress',
  component: UploadProgress,
  args: {
    fileName: 'spiel-2026-05-02.mp4',
    total: 3 * GIGABYTE,
    loaded: 0,
    elapsedMs: 0,
    phase: 'uploading',
    onCancel: fn(),
  },
} satisfies Meta<typeof UploadProgress>

export default meta
type Story = StoryObj<typeof meta>

/** The first moments: percent and size, but no rate — one sample says nothing. */
export const Starting: Story = {}

export const Midway: Story = {
  args: { loaded: 1.35 * GIGABYTE, elapsedMs: 45_000 },
}

/** Every byte sent. The response has not arrived yet. */
export const Complete: Story = {
  args: { loaded: 3 * GIGABYTE, elapsedMs: 100_000 },
}

/**
 * The wait the legacy app spent looking hung: the server reads the whole file
 * into memory before it answers.
 */
export const Processing: Story = {
  args: { loaded: 3 * GIGABYTE, elapsedMs: 100_000, phase: 'processing' },
}

/** Under the warning threshold: no note about the server's memory. */
export const SmallFile: Story = {
  args: {
    fileName: 'ausschnitt.mp4',
    total: 80_000_000,
    loaded: 24_000_000,
    elapsedMs: 6000,
  },
}
