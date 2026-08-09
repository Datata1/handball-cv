import type { Meta, StoryObj } from '@storybook/react-vite'

import { ReportHeader } from '../../components/ReportHeader'
import { longNamesMatch, match, processingMatch, rename, unnamedMatch } from '../report'

const meta = {
  title: 'Report/ReportHeader',
  component: ReportHeader,
  args: { match, rename: rename() },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ReportHeader>

export default meta
type Story = StoryObj<typeof meta>

/** Named match, named teams, recorded date and length. */
export const Default: Story = {}

/** Nothing named yet: the file name stands in and the teams read as placeholders. */
export const Unnamed: Story = {
  args: { match: unnamedMatch },
}

/** Club names as long as they really are, wrapping rather than truncating the row. */
export const LongNames: Story = {
  args: { match: longNamesMatch },
}

/**
 * Mid-ingestion, where the list row carries no date and no length — the names
 * stay editable, because they live in a meta file the pipeline never touches.
 */
export const Processing: Story = {
  args: { match: processingMatch },
}

export const Saving: Story = {
  args: {
    rename: rename({ saving: { matchId: match.match_id, field: 'team_a_name' } }),
  },
}

/** The save failed; the editor reopens on what was typed. */
export const RenameFailed: Story = {
  args: {
    rename: rename({ failed: { matchId: match.match_id, field: 'team_a_name' } }),
  },
}
