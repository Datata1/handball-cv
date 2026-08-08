import type { Meta, StoryObj } from '@storybook/react-vite'

import { Bar } from '../../data/Bar'

const meta = {
  title: 'Kit/Data/Bar',
  component: Bar,
  parameters: { layout: 'padded' },
  args: { label: '6-0', value: 0.62 },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Bar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Accent: Story = {
  args: { tone: 'accent' },
}

export const Neutral: Story = {
  args: { tone: 'neutral' },
}

/** Counts rather than a share — `max` is the total, the label says what it is. */
export const CountedAgainstTotal: Story = {
  args: { label: 'Kreuzen', value: 34, max: 91, valueLabel: '34 von 91' },
}

/** A whole distribution, which is where this component actually earns its keep. */
export const Distribution: Story = {
  render: () => (
    <div className="space-y-2">
      <Bar label="6-0" value={0.62} />
      <Bar label="5-1" value={0.24} />
      <Bar label="3-2-1" value={0.09} />
      <Bar label="Offensiv" value={0.05} />
    </div>
  ),
}

/** Nothing measured yet: an empty track, not a missing component. */
export const Zero: Story = {
  args: { value: 0 },
}
