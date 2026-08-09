import type { Meta, StoryObj } from '@storybook/react-vite'

import { Court, type CourtData, CourtLayer } from '../Court'
import type { CourtPoint } from '../projection'

const meta = {
  title: 'Kit/Court',
  component: Court,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Court>

export default meta
type Story = StoryObj<typeof meta>

/** Positions sampled from a defensive phase, in metres. */
const SAMPLE_POINTS: CourtPoint[] = [
  { x: 6.5, y: 4.2 },
  { x: 8.1, y: 7.4 },
  { x: 9.6, y: 10.2 },
  { x: 8.4, y: 13.1 },
  { x: 6.8, y: 15.9 },
  { x: 12.4, y: 10.6 },
  { x: 31.2, y: 6.1 },
  { x: 33.8, y: 10.4 },
  { x: 30.9, y: 14.2 },
]

/** A crossing move on the left goal: two backs swapping sides. */
const SAMPLE_TRACKS: { id: number; points: CourtPoint[] }[] = [
  {
    id: 12,
    points: [
      { x: 14.2, y: 6.8 },
      { x: 12.6, y: 8.4 },
      { x: 10.8, y: 10.9 },
      { x: 9.4, y: 13.2 },
      { x: 8.1, y: 14.6 },
    ],
  },
  {
    id: 7,
    points: [
      { x: 13.9, y: 13.4 },
      { x: 12.2, y: 11.8 },
      { x: 10.5, y: 9.3 },
      { x: 9.1, y: 7.1 },
      { x: 7.9, y: 5.6 },
    ],
  },
]

/** The court on its own: markings only, and its own accessible name. */
export const Empty: Story = {}

/** Turned for a portrait container. The goal at `x = 0` ends up at the top. */
export const Vertical: Story = {
  args: { orientation: 'vertical' },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
}

/** The six `/stats` zones of both halves, labelled from the `domain` namespace. */
export const Zones: Story = {
  args: { zones: 'both' },
}

/** One half, for a view that only reports the attacking end. */
export const ZonesLeftHalf: Story = {
  args: { zones: 'left' },
}

/** Turning the court moves the zones with it and leaves their labels upright. */
export const ZonesVertical: Story = {
  args: { zones: 'both', orientation: 'vertical' },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
}

/** viewBox-driven, so nothing clips or overflows as the container shrinks. */
export const NarrowContainer: Story = {
  args: { zones: 'both' },
  decorators: [
    (Story) => (
      <div className="w-56">
        <Story />
      </div>
    ),
  ],
}

const points: CourtData = {
  label: 'Positionen im Abwehrverbund',
  layer: (
    <CourtLayer>
      {SAMPLE_POINTS.map((point) => (
        <circle
          key={`${point.x}-${point.y}`}
          cx={point.x}
          cy={point.y}
          r={0.5}
          className="fill-chart-1/70"
        />
      ))}
    </CourtLayer>
  ),
  alternative: (
    <ul>
      {SAMPLE_POINTS.map((point) => (
        <li key={`${point.x}-${point.y}`}>{`${point.x} m, ${point.y} m`}</li>
      ))}
    </ul>
  ),
}

/** A data layer positioned in metres — the projection stays out of the caller. */
export const Points: Story = { args: { data: points } }

/** The same layer, unchanged, on a court that has been turned. */
export const PointsVertical: Story = {
  args: { data: points, orientation: 'vertical' },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
}

const trajectories: CourtData = {
  label: 'Laufwege eines Kreuzens auf das linke Tor',
  layer: (
    <CourtLayer>
      <rect x={-1} y={8.5} width={1} height={3} className="fill-chart-5" />
      {SAMPLE_TRACKS.map((track, index) => (
        <g key={track.id} className={index === 0 ? 'stroke-chart-1' : 'stroke-chart-2'}>
          <polyline
            points={track.points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            strokeWidth={0.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={track.points[track.points.length - 1].x}
            cy={track.points[track.points.length - 1].y}
            r={0.45}
            className={index === 0 ? 'fill-chart-1' : 'fill-chart-2'}
            strokeWidth={0}
          />
        </g>
      ))}
    </CourtLayer>
  ),
  alternative: (
    <ul>
      {SAMPLE_TRACKS.map((track) => (
        <li key={track.id}>
          {`Track ${track.id}: ${track.points
            .map((p) => `${p.x} m, ${p.y} m`)
            .join(' → ')}`}
        </li>
      ))}
    </ul>
  ),
}

/** Trajectories, with the attacked goal marked. */
export const Trajectories: Story = { args: { data: trajectories } }
