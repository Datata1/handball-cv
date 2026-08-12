import { COURT_LENGTH_M, COURT_MARGIN_M, COURT_WIDTH_M } from '../geometry'
import {
  type CourtOrientation,
  type CourtPoint,
  courtLayerTransform,
  courtViewBox,
  courtViewBoxSize,
  createCourtProjection,
} from '../projection'

const ORIENTATIONS: CourtOrientation[] = ['horizontal', 'vertical']

const TOP_LEFT: CourtPoint = { x: 0, y: 0 }
const BOTTOM_RIGHT: CourtPoint = { x: COURT_LENGTH_M, y: COURT_WIDTH_M }
const CENTRE: CourtPoint = { x: COURT_LENGTH_M / 2, y: COURT_WIDTH_M / 2 }

function distance(a: CourtPoint, b: CourtPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * jsdom does not implement SVG geometry, so the layer transform is applied by
 * hand. Only `translate` and `rotate` are understood — enough for what
 * `courtLayerTransform` emits, and it fails loudly if that ever grows.
 */
function applyTransform(transform: string | undefined, point: CourtPoint): CourtPoint {
  const operations = [...(transform ?? '').matchAll(/(\w+)\(([^)]*)\)/g)].reverse()

  return operations.reduce((current, [, name, rawArgs]) => {
    const args = rawArgs
      .trim()
      .split(/[\s,]+/)
      .map(Number)

    if (name === 'translate') {
      return { x: current.x + args[0], y: current.y + (args[1] ?? 0) }
    }

    if (name === 'rotate') {
      const angle = (args[0] * Math.PI) / 180
      return {
        x: current.x * Math.cos(angle) - current.y * Math.sin(angle),
        y: current.x * Math.sin(angle) + current.y * Math.cos(angle),
      }
    }

    throw new Error(`unsupported transform: ${name}`)
  }, point)
}

describe('court projection', () => {
  describe('horizontal', () => {
    const { toX, toY } = createCourtProjection('horizontal')

    it('puts the goal-line corner at the origin', () => {
      expect(toX(TOP_LEFT)).toBe(0)
      expect(toY(TOP_LEFT)).toBe(0)
    })

    it('puts the far corner at the far end of the court box', () => {
      expect(toX(BOTTOM_RIGHT)).toBe(COURT_LENGTH_M)
      expect(toY(BOTTOM_RIGHT)).toBe(COURT_WIDTH_M)
    })

    it('puts the throw-off point at the centre', () => {
      expect(toX(CENTRE)).toBe(COURT_LENGTH_M / 2)
      expect(toY(CENTRE)).toBe(COURT_WIDTH_M / 2)
    })
  })

  describe('vertical', () => {
    const { toX, toY } = createCourtProjection('vertical')

    it('turns the court so the goal at x = 0 is at the top', () => {
      expect(toY(TOP_LEFT)).toBe(0)
      expect(toY(BOTTOM_RIGHT)).toBe(COURT_LENGTH_M)
    })

    it('spans the short axis across the width', () => {
      expect(toX(TOP_LEFT)).toBe(COURT_WIDTH_M)
      expect(toX(BOTTOM_RIGHT)).toBe(0)
    })

    it('still puts the throw-off point at the centre', () => {
      expect(toX(CENTRE)).toBe(COURT_WIDTH_M / 2)
      expect(toY(CENTRE)).toBe(COURT_LENGTH_M / 2)
    })
  })

  it.each(ORIENTATIONS)('preserves distances in %s', (orientation) => {
    const projection = createCourtProjection(orientation)
    const a: CourtPoint = { x: 6.5, y: 4.2 }
    const b: CourtPoint = { x: 31.2, y: 17.8 }

    const projected = distance(
      { x: projection.toX(a), y: projection.toY(a) },
      { x: projection.toX(b), y: projection.toY(b) },
    )

    expect(projected).toBeCloseTo(distance(a, b), 10)
  })

  it.each(ORIENTATIONS)('scales lengths like coordinates in %s', (orientation) => {
    const { toX, toY, toLength } = createCourtProjection(orientation)
    const along = { from: { x: 0, y: 0 }, to: { x: 10, y: 0 } }
    const across = { from: { x: 0, y: 0 }, to: { x: 0, y: 10 } }

    const alongSpan = Math.hypot(
      toX(along.to) - toX(along.from),
      toY(along.to) - toY(along.from),
    )
    const acrossSpan = Math.hypot(
      toX(across.to) - toX(across.from),
      toY(across.to) - toY(across.from),
    )

    expect(alongSpan).toBeCloseTo(toLength(10), 10)
    expect(acrossSpan).toBeCloseTo(toLength(10), 10)
  })

  it.each(ORIENTATIONS)('is pure — no render, no size, in %s', (orientation) => {
    const first = createCourtProjection(orientation)
    const second = createCourtProjection(orientation)
    const point: CourtPoint = { x: 17.3, y: 4.9 }

    expect(first.toX(point)).toBe(second.toX(point))
    expect(first.toY(point)).toBe(second.toY(point))
    expect(first.toLength(3.5)).toBe(second.toLength(3.5))
  })

  it('builds a polyline in projected coordinates', () => {
    const { toPolyline } = createCourtProjection('horizontal')

    expect(
      toPolyline([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]),
    ).toBe('1,2 3,4')
  })

  it.each(ORIENTATIONS)('frames the whole court plus margin in %s', (orientation) => {
    const [minX, minY, width, height] = courtViewBox(orientation).split(' ').map(Number)

    const long = COURT_LENGTH_M + 2 * COURT_MARGIN_M
    const short = COURT_WIDTH_M + 2 * COURT_MARGIN_M

    expect(minX).toBe(-COURT_MARGIN_M)
    expect(minY).toBe(-COURT_MARGIN_M)
    expect(width).toBe(orientation === 'horizontal' ? long : short)
    expect(height).toBe(orientation === 'horizontal' ? short : long)
  })

  // A pixel surface laid over the court is sized from this, so it has to be
  // the same box the viewBox names.
  it.each(ORIENTATIONS)('reports that frame as a size too, in %s', (orientation) => {
    const [, , width, height] = courtViewBox(orientation).split(' ').map(Number)

    expect(courtViewBoxSize(orientation)).toEqual({ width, height })
  })

  it.each(ORIENTATIONS)(
    'moves a CourtLayer child exactly where the projection says, in %s',
    (orientation) => {
      const projection = createCourtProjection(orientation)
      const transform = courtLayerTransform(orientation)

      for (const point of [TOP_LEFT, BOTTOM_RIGHT, CENTRE, { x: 6.5, y: 17.2 }]) {
        const applied = applyTransform(transform, point)

        expect(applied.x).toBeCloseTo(projection.toX(point), 10)
        expect(applied.y).toBeCloseTo(projection.toY(point), 10)
      }
    },
  )

  it('leaves the horizontal court untransformed', () => {
    expect(courtLayerTransform('horizontal')).toBeUndefined()
  })

  it('rotates rather than mirrors the vertical court', () => {
    // A transpose would swap the wings; the layer transform has to agree with
    // the projection, which rotates.
    expect(courtLayerTransform('vertical')).toBe(
      `translate(${COURT_WIDTH_M} 0) rotate(90)`,
    )
  })
})
