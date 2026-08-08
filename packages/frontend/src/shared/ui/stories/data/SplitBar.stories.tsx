import type { Meta, StoryObj } from '@storybook/react-vite'

import { SplitBar } from '../../data/SplitBar'

const meta = {
  title: 'Kit/Data/SplitBar',
  component: SplitBar,
  parameters: { layout: 'padded' },
  args: {
    start: { label: 'Heim', value: 1840 },
    end: { label: 'Gast', value: 1420 },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SplitBar>

export default meta
type Story = StoryObj<typeof meta>

/** Raw counts in, shares out. */
export const Default: Story = {}

export const Lopsided: Story = {
  args: {
    start: { label: 'Heim', value: 2980 },
    end: { label: 'Gast', value: 260 },
  },
}

/** Callers can label the sides with the underlying figure instead of a share. */
export const CustomValueLabels: Story = {
  args: {
    start: { label: 'Heim', value: 1840, valueLabel: '30:40 min' },
    end: { label: 'Gast', value: 1420, valueLabel: '23:40 min' },
  },
}

/** Nothing measured on either side — an empty track rather than a 50/50 lie. */
export const NothingMeasured: Story = {
  args: {
    start: { label: 'Heim', value: 0 },
    end: { label: 'Gast', value: 0 },
  },
}
