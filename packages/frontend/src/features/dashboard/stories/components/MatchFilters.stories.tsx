import type { Meta, StoryObj } from '@storybook/react-vite'

import { MatchFilters } from '../../components/MatchFilters'

const meta = {
  title: 'Dashboard/MatchFilters',
  component: MatchFilters,
  parameters: { layout: 'padded' },
  args: {
    query: '',
    sort: 'recent',
    onQueryChange: () => {},
    onSortChange: () => {},
  },
} satisfies Meta<typeof MatchFilters>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Searching: Story = { args: { query: 'Nord' } }

export const SortedByName: Story = { args: { sort: 'name' } }
