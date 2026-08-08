import type { Meta, StoryObj } from '@storybook/react-vite'

import { StatTile } from '../../data/StatTile'

const meta = {
  title: 'Kit/Data/StatTile',
  component: StatTile,
  parameters: { layout: 'padded' },
  args: { label: 'Tore gesamt', value: 58 },
} satisfies Meta<typeof StatTile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithUnit: Story = {
  args: { label: 'Spieldauer', value: '61:12', unit: 'min' },
}

export const WithHint: Story = {
  args: {
    label: 'Erkannte Tracks',
    value: 27,
    hint: 'Tracks, nicht Spieler — eine Person kann mehrere Tracks erzeugen.',
  },
}

/** No measurement for this field. It says so instead of showing a zero. */
export const NotMeasured: Story = {
  args: { label: 'Ballbesitz Heim', value: null },
}

export const InAGrid: Story = {
  render: (args) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile {...args} />
      <StatTile label="Spieldauer" value="61:12" unit="min" />
      <StatTile label="Frames" value="91 800" />
      <StatTile label="Ballbesitz Heim" value={null} />
    </div>
  ),
}
