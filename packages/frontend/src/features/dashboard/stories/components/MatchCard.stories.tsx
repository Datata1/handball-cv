import type { Meta, StoryObj } from '@storybook/react-vite'

import { withRouter } from '@/testing/router'

import { MatchCard } from '../../components/MatchCard'
import {
  brokenThumbnailSrc,
  done,
  failed,
  longNames,
  processing,
  thumbnailSrc,
  unnamed,
} from '../matches'
import { mutations } from '../mutations'

const meta = {
  title: 'Dashboard/MatchCard',
  component: MatchCard,
  parameters: { layout: 'centered' },
  decorators: [
    withRouter(),
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: { match: done, thumbnailSrc, mutations: mutations() },
} satisfies Meta<typeof MatchCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { score: { home: 24, away: 22 } } }

/** No scoreboard readings — the endpoint 404s, and the card says nothing. */
export const WithoutScore: Story = { args: { score: null } }

/** Named by its file, because nobody has renamed it yet. */
export const Unnamed: Story = { args: { match: unnamed, score: null } }

export const LongNames: Story = {
  args: { match: longNames, score: { home: 31, away: 30 } },
}

/** A stub row: no file name, no duration, no date, and not openable. */
export const Processing: Story = { args: { match: processing } }

export const Failed: Story = { args: { match: failed } }

export const MissingThumbnail: Story = {
  args: { thumbnailSrc: brokenThumbnailSrc, score: { home: 18, away: 21 } },
}

/** A name is being saved. The field stays focusable so Enter does not strand focus. */
export const Renaming: Story = {
  args: {
    score: { home: 24, away: 22 },
    mutations: mutations({ saving: { matchId: done.match_id, field: 'team_a_name' } }),
  },
}

/** The save failed: the value rolled back, and the field says so. */
export const RenameFailed: Story = {
  args: {
    score: { home: 24, away: 22 },
    mutations: mutations({
      renameFailed: { matchId: done.match_id, field: 'team_a_name' },
    }),
  },
}

export const DeleteFailed: Story = {
  args: {
    score: { home: 24, away: 22 },
    mutations: mutations({
      deleteFailed: { matchId: done.match_id, blocked: false },
    }),
  },
}

/**
 * The delete 404'd while a match was being ingested — which is what the backend
 * answers for a match that is perfectly present. Different sentence, and the
 * card stays.
 */
export const DeleteBlocked: Story = {
  args: {
    score: { home: 24, away: 22 },
    mutations: mutations({ deleteFailed: { matchId: done.match_id, blocked: true } }),
  },
}
