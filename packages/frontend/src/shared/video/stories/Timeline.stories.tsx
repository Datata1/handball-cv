import type { Meta, StoryObj } from '@storybook/react-vite'

import { withStores } from '@/testing/stores'

import { Timeline } from '../Timeline'
import type { TimelineItem, TimelineTrack } from '../types'

/** A full match, so the bars sit at plausible fractions of the lane. */
const DURATION = 3_600

const GOALS: TimelineItem[] = [
  { id: 'goal-1', start: 138, label: 'Tor Team A, 1:0', tone: 'event' },
  { id: 'goal-2', start: 402, label: 'Tor Team B, 1:1', tone: 'event' },
  { id: 'goal-3', start: 735, label: 'Tor Team A, 2:1', tone: 'event' },
  { id: 'goal-4', start: 1_284, label: 'Tor Team A, 3:1', tone: 'event' },
  { id: 'goal-5', start: 1_902, label: 'Tor Team B, 3:2', tone: 'event' },
  { id: 'goal-6', start: 2_450, label: 'Tor Team B, 3:3', tone: 'event' },
  { id: 'goal-7', start: 3_011, label: 'Tor Team A, 4:3', tone: 'event' },
  { id: 'goal-8', start: 3_540, label: 'Tor Team B, 4:4', tone: 'event' },
]

function phases(count: number): TimelineItem[] {
  const spacing = DURATION / count

  return Array.from({ length: count }, (_, index) => {
    const start = 20 + index * spacing
    const teamA = index % 2 === 0

    return {
      id: `phase-${index + 1}`,
      start,
      end: start + Math.min(18 + (index % 5) * 6, spacing * 0.8),
      label: `Phase ${index + 1}, ${teamA ? 'Team A' : 'Team B'} Angriff`,
      short: `P${index + 1}`,
      tone: teamA ? 'teamA' : 'teamB',
    }
  })
}

const PLAYS: TimelineItem[] = [
  { id: 'play-1', start: 118, end: 131, label: 'Kreuzen, Team A', tone: 'teamA' },
  { id: 'play-2', start: 388, end: 399, label: 'Einläufer, Team B', tone: 'teamB' },
  { id: 'play-3', start: 1_270, end: 1_283, label: 'Kreuzen, Team A', tone: 'teamA' },
  {
    id: 'play-4',
    start: 2_430,
    end: 2_448,
    label: 'Parallelstoß, Team B',
    tone: 'teamB',
  },
  {
    id: 'play-5',
    start: 3_490,
    end: 3_502,
    label: 'Tempogegenstoß, Team B',
    tone: 'teamB',
  },
]

const FORMATIONS: TimelineItem[] = [
  { id: 'formation-1', start: 0, end: 820, label: '6-0, Team B', short: '6-0' },
  { id: 'formation-2', start: 820, end: 1_640, label: '5-1, Team A', short: '5-1' },
  { id: 'formation-3', start: 1_640, end: 2_700, label: '6-0, Team A', short: '6-0' },
  { id: 'formation-4', start: 2_700, end: 3_600, label: '4-2, Team B', short: '4-2' },
]

const PHASES = phases(14)

const ALL_TRACKS: TimelineTrack[] = [
  { id: 'goals', label: 'Tore', kind: 'marker', items: GOALS },
  { id: 'phases', label: 'Ballbesitz', kind: 'interval', items: PHASES },
  { id: 'plays', label: 'Spielzüge', kind: 'interval', items: PLAYS },
  { id: 'formations', label: 'Formationen', kind: 'interval', items: FORMATIONS },
]

const meta = {
  title: 'Kit/Timeline',
  component: Timeline,
  args: { duration: DURATION, tracks: ALL_TRACKS },
  parameters: { layout: 'padded' },
  decorators: [
    withStores((store) => {
      store.player.setDuration(DURATION)
      store.player.seek(1_284)
      store.player.clearSeek()
    }),
  ],
} satisfies Meta<typeof Timeline>

export default meta
type Story = StoryObj<typeof meta>

/** Goals, possession, plays and formations, with the playhead across all four. */
export const AllTracks: Story = {}

/** What a section with one kind of event shows. */
export const SingleTrack: Story = {
  args: { tracks: [ALL_TRACKS[1]] },
}

/** Nothing detected yet — the match is ingested but never scored. */
export const Empty: Story = {
  args: { tracks: [] },
}

/** Tracks that exist but hold nothing keep their lanes, so the rows still line up. */
export const EmptyTracks: Story = {
  args: {
    tracks: ALL_TRACKS.map((track) => ({ ...track, items: [] })),
  },
}

/** The selected bar, and the one item the roving tabindex starts on. */
export const WithSelection: Story = {
  args: { selectedId: 'phase-4' },
}

/** 320 phases: the width floor is what keeps each one visible and clickable. */
export const Dense: Story = {
  args: {
    tracks: [
      { id: 'phases', label: 'Ballbesitz', kind: 'interval', items: phases(320) },
    ],
  },
}

/** The report sidebar width, where the label column costs the most. */
export const NarrowContainer: Story = {
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}

/** A scene is playing: the store confines the playhead to the clip. */
export const WithClip: Story = {
  decorators: [
    withStores((store) => {
      store.player.setDuration(DURATION)
      store.player.setClip({ start: 1_270, end: 1_298 })
      store.player.clearSeek()
    }),
  ],
}
