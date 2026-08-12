import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ApiError } from '@/shared/api'

import { FormationDistribution } from '../../components/FormationDistribution'
import {
  label,
  novelFormationSummary,
  phaseOnlySummary,
  singleFormationSummary,
  summary,
  teamName,
} from '../defense'

const meta = {
  title: 'Defense/FormationDistribution',
  component: FormationDistribution,
  parameters: { layout: 'padded' },
  args: {
    summary,
    teamName,
    label,
    selected: {},
    onSelect: fn(),
  },
} satisfies Meta<typeof FormationDistribution>

export default meta
type Story = StoryObj<typeof meta>

/** Both teams, with `attack`, `transition` and `unknown` filtered out. */
export const Default: Story = {}

export const SingleFormation: Story = {
  args: { summary: singleFormationSummary },
}

/**
 * Labels no dictionary knows, as the GCN + LSTM classifier will produce. They
 * render under their own names — the one thing this section may never get wrong.
 */
export const NovelLabels: Story = {
  args: { summary: novelFormationSummary },
}

export const DrilledIn: Story = {
  args: { selected: { team: 'A', formation: '6-0' } },
}

/** Classified, but only into phases: there is no shape to report. */
export const PhaseLabelsOnly: Story = {
  args: { summary: phaseOnlySummary },
}

/** The match was ingested but never scored — a 404 that is not an error. */
export const NotScored: Story = {
  args: {
    summary: undefined,
    error: new ApiError(
      404,
      "No formation data for match 'seed01'. Run wels-score first.",
      '/matches/seed01/formation-summary',
    ),
  },
}

export const Loading: Story = {
  args: { summary: undefined },
}

export const Failed: Story = {
  args: {
    summary: undefined,
    error: new ApiError(
      500,
      'Internal Server Error',
      '/matches/seed01/formation-summary',
    ),
    onRetry: fn(),
  },
}

/** Mid-ingestion, where the same 404 means the reads are frozen. */
export const Frozen: Story = {
  args: {
    summary: undefined,
    error: new ApiError(404, 'Not found', '/matches/seed01/formation-summary'),
    frozen: true,
    onRetry: fn(),
  },
}
