import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { fn } from 'storybook/test'

import { ApiError, ApiTransportError, type MatchMeta } from '@/shared/api'
import { qk } from '@/shared/query'

import { RouteError } from '../../components/RouteError'

const match = (status: MatchMeta['status']): MatchMeta => ({
  match_id: 'abc123',
  file_name: 'spiel.mp4',
  video_path: 'data/input/videos/spiel.mp4',
  fps: 25,
  total_frames: 90_000,
  status,
  duration: '60:00',
  date: '2026-03-14T19:30:00',
  ingested_at: '2026-03-14T19:30:00',
  display_name: null,
  team_a_name: null,
  team_b_name: null,
})

/**
 * `RouteError` asks the cache whether a 404 is real, so the cache is the story's
 * fixture. An unseeded cache is its own case: "not loaded yet" counts as
 * ambiguous, which is why `Frozen` needs no seeding at all.
 */
function withMatches(matches: MatchMeta[]): Decorator {
  return function SeedMatches(Story) {
    const queryClient = useQueryClient()
    useState(() => queryClient.setQueryData(qk.matches(), matches))

    return <Story />
  }
}

const meta = {
  title: 'App/RouteError',
  component: RouteError,
  parameters: { layout: 'padded' },
  args: { reset: fn() },
  decorators: [withMatches([match('done')])],
} satisfies Meta<typeof RouteError>

export default meta
type Story = StoryObj<typeof meta>

export const Unreachable: Story = {
  args: { error: new ApiTransportError('/api/v1/matches', new TypeError('fetch')) },
}

/** The match list is loaded and nothing is processing, so gone means gone. */
export const NotFound: Story = {
  args: { error: new ApiError(404, 'Match not found', '/api/v1/matches/abc123') },
}

/** The same 404 during an ingest — the backend freezes reads for every match. */
export const Frozen: Story = {
  args: { error: new ApiError(404, 'Match not found', '/api/v1/matches/abc123') },
  decorators: [withMatches([match('processing')])],
}

/** A `validateSearch` failure: a hand-edited URL the schema refused. */
export const BadSearchParams: Story = {
  args: { error: new Error('Invalid search params found in the URL') },
}
