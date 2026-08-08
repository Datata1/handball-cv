import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ApiError, ApiTransportError, ApiValidationError } from '@/shared/api'

import { ErrorState } from '../../state/ErrorState'

const meta = {
  title: 'Kit/State/ErrorState',
  component: ErrorState,
  parameters: { layout: 'padded' },
  args: { onRetry: fn() },
} satisfies Meta<typeof ErrorState>

export default meta
type Story = StoryObj<typeof meta>

export const Unreachable: Story = {
  args: { error: new ApiTransportError('/api/v1/matches', new TypeError('fetch')) },
}

export const NotFound: Story = {
  args: { error: new ApiError(404, 'Match not found', '/api/v1/matches/17') },
}

/**
 * The same 404, but a match is being ingested — so it means "not yet", and the
 * page must not claim the match is gone.
 */
export const FrozenByProcessing: Story = {
  args: {
    error: new ApiError(404, 'Match not found', '/api/v1/matches/17'),
    processing: true,
  },
}

export const ContractChanged: Story = {
  args: {
    error: new ApiValidationError('/api/v1/matches', '✖ Expected number at fps'),
  },
}

/** Nothing to retry — a background refetch is already running. */
export const WithoutRetry: Story = {
  args: {
    error: new ApiError(500, 'Internal Server Error', '/api/v1/matches'),
    onRetry: undefined,
  },
}
