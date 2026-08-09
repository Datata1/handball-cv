import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { withStores } from '@/testing/stores'

import { ReportPlayer } from '../../components/ReportPlayer'
import { DURATION_S, phases, teamName } from '../report'

/**
 * No file is served at the match video URL in the workshop, so the element
 * shows its own "cannot load" frame. Everything around it is the point.
 */
const meta = {
  title: 'Report/ReportPlayer',
  component: ReportPlayer,
  args: {
    matchId: 'seed01',
    status: 'done',
    annotated: 'ready',
    phases,
    teamName,
    onShareMoment: fn(),
  },
  parameters: { layout: 'padded' },
  decorators: [
    withStores((store) => {
      store.player.setDuration(DURATION_S)
      store.player.seek(130)
      store.player.clearSeek()
    }),
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReportPlayer>

export default meta
type Story = StoryObj<typeof meta>

/** A finished match with a render: badge, moment link and source toggle. */
export const Default: Story = {}

/** Ingested without `annotate_video`, so there is no source to switch to. */
export const NoAnnotatedVideo: Story = {
  args: { annotated: 'absent' },
}

export const AnnotatedStillRendering: Story = {
  args: { annotated: 'processing' },
}

/** Scoring has not run: no phases, so no badge above the player. */
export const NoPhases: Story = {
  args: { phases: [] },
}

/** The match itself is still being ingested — there is nothing to play yet. */
export const MatchProcessing: Story = {
  args: { status: 'processing' },
}

/** Ingestion failed, so no video was ever written. */
export const MatchFailed: Story = {
  args: { status: 'failed' },
}
