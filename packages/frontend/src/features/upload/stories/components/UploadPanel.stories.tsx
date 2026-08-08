import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ApiError, ApiTransportError } from '@/shared/api'

import { UploadPanel } from '../../components/UploadPanel'

const GIGABYTE = 1000 ** 3

const meta = {
  title: 'Upload/UploadPanel',
  component: UploadPanel,
  args: {
    status: { phase: 'idle' },
    annotate: false,
    onAnnotateChange: fn(),
    onSelect: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof UploadPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Idle: Story = {}

/** The consequence of the flag is in the hint, not left to be discovered later. */
export const AnnotateChecked: Story = { args: { annotate: true } }

export const Uploading: Story = {
  args: {
    status: {
      phase: 'uploading',
      fileName: 'spiel-2026-05-02.mp4',
      loaded: 1.35 * GIGABYTE,
      total: 3 * GIGABYTE,
      elapsedMs: 45_000,
    },
  },
}

export const Processing: Story = {
  args: {
    status: {
      phase: 'processing',
      fileName: 'spiel-2026-05-02.mp4',
      total: 3 * GIGABYTE,
    },
  },
}

/** Caught client-side: this file never left the machine. */
export const UnsupportedFormat: Story = {
  args: {
    status: { phase: 'rejected', fileName: 'notizen.txt', reason: 'unsupportedFormat' },
  },
}

export const MissingExtension: Story = {
  args: {
    status: {
      phase: 'rejected',
      fileName: 'spielaufzeichnung',
      reason: 'missingExtension',
    },
  },
}

export const NetworkError: Story = {
  args: {
    status: {
      phase: 'failed',
      fileName: 'spiel-2026-05-02.mp4',
      error: new ApiTransportError('/videos/upload', new Error('offline')),
    },
  },
}

/** The backend's own format check, for the extensions the client lets through. */
export const RejectedByServer: Story = {
  args: {
    status: {
      phase: 'failed',
      fileName: 'spiel-2026-05-02.mp4',
      error: new ApiError(400, 'Unsupported file format: mp4.', '/videos/upload'),
    },
  },
}

export const Cancelled: Story = {
  args: { status: { phase: 'cancelled', fileName: 'spiel-2026-05-02.mp4' } },
}
