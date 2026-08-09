import type { Meta, StoryObj } from '@storybook/react-vite'

import { withStores } from '@/testing/stores'

import { ClippedVideo } from '../ClippedVideo'
import { Timeline } from '../Timeline'
import type { TimelineTrack } from '../types'

/**
 * No file is served at this path, so the workshop shows the player's own
 * "cannot load" frame. That is the point: nothing here depends on a decoded
 * video, only on the element and the store around it.
 */
const SRC = '/api/v1/matches/demo/video'

const meta = {
  title: 'Kit/ClippedVideo',
  component: ClippedVideo,
  args: { src: SRC },
  parameters: { layout: 'padded' },
  decorators: [
    withStores(),
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ClippedVideo>

export default meta
type Story = StoryObj<typeof meta>

/** The whole match: native controls, no clip, free scrubbing. */
export const Default: Story = {}

/** A possession phase. Playback stops and rewinds at the end of the window. */
export const Clipped: Story = {
  args: { clip: { start: 724, end: 751 } },
}

/** A detected play, which loops so the move can be watched twice over. */
export const LoopingScene: Story = {
  args: { clip: { start: 1_284.5, end: 1_298 }, autoLoop: true },
}

/** The annotated render, which the report's source toggle names differently. */
export const Annotated: Story = {
  args: { label: 'Annotiertes Spielvideo' },
}

const MATCH_DURATION = 2_400

const TRACKS: TimelineTrack[] = [
  {
    id: 'goals',
    label: 'Tore',
    kind: 'marker',
    items: [
      { id: 'goal-1', start: 138, label: 'Tor Team A, 1:0', tone: 'event' },
      { id: 'goal-2', start: 402, label: 'Tor Team B, 1:1', tone: 'event' },
    ],
  },
  {
    id: 'phases',
    label: 'Ballbesitz',
    kind: 'interval',
    items: [
      {
        id: 'phase-1',
        start: 120,
        end: 141,
        label: 'Phase 1, Team A Angriff',
        short: 'P1',
        tone: 'teamA',
      },
      {
        id: 'phase-2',
        start: 380,
        end: 410,
        label: 'Phase 2, Team B Angriff',
        short: 'P2',
        tone: 'teamB',
      },
      {
        id: 'phase-3',
        start: 900,
        end: 948,
        label: 'Phase 3, Team A Angriff',
        short: 'P3',
        tone: 'teamA',
      },
    ],
  },
]

/**
 * The pair the report is built from: the timeline seeks the player, the player
 * moves the playhead. Neither knows about the other — the store is between them.
 */
export const WithTimeline: Story = {
  render: (args) => (
    <div className="space-y-4">
      <ClippedVideo {...args} />
      <Timeline duration={MATCH_DURATION} tracks={TRACKS} />
    </div>
  ),
}
