import type { Meta, StoryObj } from '@storybook/react-vite'

import { ApiError, ApiTransportError } from '@/shared/api'
import { withRouter } from '@/testing/router'

import { MatchList } from '../../components/MatchList'
import { done, mixed, unnamed } from '../matches'
import { mutations } from '../mutations'

const scores = new Map([
  ['seed01', { home: 24, away: 22 }],
  ['seed02', null],
])

const meta = {
  title: 'Dashboard/MatchList',
  component: MatchList,
  parameters: { layout: 'padded' },
  decorators: [withRouter()],
  args: { matches: [done, unnamed], scores, mutations: mutations() },
} satisfies Meta<typeof MatchList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SingleMatch: Story = { args: { matches: [done] } }

/** Done, in flight and failed side by side — the list never hides a match. */
export const MixedStatuses: Story = { args: { matches: mixed } }

/** First load only: a background refetch keeps the cards it already has. */
export const Loading: Story = { args: { matches: undefined } }

export const Empty: Story = { args: { matches: [] } }

/** Same emptiness, different cause — so it gets different copy and no upload call. */
export const NoSearchResults: Story = { args: { matches: [], searching: true } }

export const Failed: Story = {
  args: { matches: undefined, error: new ApiTransportError('/matches', undefined) },
}

export const ServerError: Story = {
  args: {
    matches: undefined,
    error: new ApiError(500, 'Internal Server Error', '/matches'),
    onRetry: () => {},
  },
}
