import type { HeatmapPoint } from '@/shared/api'
import { COURT_LENGTH_M, COURT_MARGIN_M, COURT_WIDTH_M, zoneAt } from '@/shared/court'

import {
  ALPHA_FLOOR,
  colourise,
  type DensityLayer,
  densitySize,
  MAX_PEAK,
  MIN_PEAK,
  PX_PER_M,
  projectPoints,
  RADIUS_SCALE,
  rampAlpha,
  renderDensity,
  stampPeak,
  stampStops,
} from '../density'
import type { DensityPalette } from '../palette'
import { asContext, stubCanvases } from './stub-canvas'

const CENTRE: HeatmapPoint = { x: COURT_LENGTH_M / 2, y: COURT_WIDTH_M / 2, team: 'A' }

const PALETTE: DensityPalette = {
  A: { r: 10, g: 20, b: 30 },
  B: { r: 200, g: 100, b: 50 },
  U: { r: 128, g: 128, b: 128 },
}

function layer(alphas: readonly number[], colour: { r: number; g: number; b: number }) {
  const pixels = new Uint8ClampedArray(alphas.length * 4)
  alphas.forEach((alpha, index) => {
    pixels[index * 4 + 3] = alpha
  })

  return { pixels, colour } satisfies DensityLayer
}

describe('density surface', () => {
  it('covers the same box the court is drawn in', () => {
    expect(densitySize('horizontal')).toEqual({
      width: (COURT_LENGTH_M + 2 * COURT_MARGIN_M) * PX_PER_M,
      height: (COURT_WIDTH_M + 2 * COURT_MARGIN_M) * PX_PER_M,
    })
  })

  it('turns the surface with the court rather than transposing it', () => {
    const horizontal = densitySize('horizontal')

    expect(densitySize('vertical')).toEqual({
      width: horizontal.height,
      height: horizontal.width,
    })
  })
})

describe('projectPoints', () => {
  it('puts the centre spot at the centre of the surface', () => {
    const { width, height } = densitySize('horizontal')
    const [point] = projectPoints([CENTRE])

    expect(point.x).toBeCloseTo(width / 2, 6)
    expect(point.y).toBeCloseTo(height / 2, 6)
  })

  // A transposed court would swap the wings, which is why this goes through the
  // same projection the SVG uses.
  it('follows the court into the vertical orientation', () => {
    const wing: HeatmapPoint = { x: 4, y: 2, team: 'B' }
    const [point] = projectPoints([wing], 'vertical')

    expect(point.x).toBeCloseTo((COURT_WIDTH_M - wing.y + COURT_MARGIN_M) * PX_PER_M, 6)
    expect(point.y).toBeCloseTo((wing.x + COURT_MARGIN_M) * PX_PER_M, 6)
  })

  it('spreads a point by the spread of the zone it is in', () => {
    const point: HeatmapPoint = { x: 10.65, y: 10, team: 'A' }
    const [projected] = projectPoints([point])

    expect(projected.radius).toBe(
      Math.round(zoneAt(point).spread * RADIUS_SCALE * PX_PER_M),
    )
  })

  // The endpoint caps at 12 000 and the legacy view then strided it down to
  // 3 500 before exploding each survivor into 13 splats. One stamp per point
  // removes the reason for both.
  it('keeps every point it is given', () => {
    const points = Array.from({ length: 12_000 }, () => CENTRE)

    expect(projectPoints(points)).toHaveLength(12_000)
  })

  it('leaves a position off the court where it was measured', () => {
    const [point] = projectPoints([{ x: -3, y: 25, team: 'U' }])

    expect(point.x).toBeLessThan(0)
    expect(point.y).toBeGreaterThan(densitySize('horizontal').height)
  })
})

describe('stampStops', () => {
  it('runs from the given peak at the centre to a transparent rim', () => {
    const stops = stampStops(0.3)

    expect(stops[0]).toEqual({ offset: 0, alpha: 0.3 })
    expect(stops[stops.length - 1]).toEqual({ offset: 1, alpha: 0 })
  })

  // A stamp that still has alpha at its rim draws a visible disc edge as soon
  // as a few of them overlap.
  it('falls off without a step at any stop', () => {
    const stops = stampStops(MAX_PEAK)

    for (let index = 1; index < stops.length; index++) {
      expect(stops[index].alpha).toBeLessThan(stops[index - 1].alpha)
      expect(stops[index].offset).toBeGreaterThan(stops[index - 1].offset)
    }
  })
})

describe('stampPeak', () => {
  // A fixed alpha either wastes the 8 bits a layer has on a handful of points,
  // or drives a whole-match cloud to opaque everywhere.
  it('thins the ink as the cloud grows', () => {
    expect(stampPeak(40)).toBeGreaterThan(stampPeak(1_240))
    expect(stampPeak(1_240)).toBeGreaterThan(stampPeak(12_000))
  })

  it('stays inside a range both ends of the ramp can still resolve', () => {
    for (const count of [0, 1, 40, 1_240, 12_000, 10 ** 6]) {
      expect(stampPeak(count)).toBeGreaterThanOrEqual(MIN_PEAK)
      expect(stampPeak(count)).toBeLessThanOrEqual(MAX_PEAK)
    }
  })

  // 8-bit layers: below about 1/255 per stamp, a point stops registering at all.
  it('keeps a single stamp visible in an 8-bit layer', () => {
    expect(stampPeak(12_000) * 255).toBeGreaterThan(1)
  })
})

describe('rampAlpha', () => {
  it('draws nothing at all for the emptiest pixels', () => {
    expect(rampAlpha(0)).toBe(0)
    expect(rampAlpha(ALPHA_FLOOR)).toBe(0)
  })

  it('never reaches full opacity, so the court stays visible under it', () => {
    expect(rampAlpha(1)).toBeGreaterThan(0.5)
    expect(rampAlpha(1)).toBeLessThan(1)
  })

  it('rises with intensity', () => {
    const steps = [0.1, 0.3, 0.5, 0.7, 0.9, 1].map(rampAlpha)

    for (let index = 1; index < steps.length; index++) {
      expect(steps[index]).toBeGreaterThan(steps[index - 1])
    }
  })

  it('clamps rather than extrapolating', () => {
    expect(rampAlpha(4)).toBe(rampAlpha(1))
    expect(rampAlpha(-1)).toBe(0)
  })
})

describe('colourise', () => {
  it('paints a single team in its own colour, ramped by intensity', () => {
    const out = new Uint8ClampedArray(3 * 4)
    colourise([layer([255, 128, 0], PALETTE.A)], out)

    expect([...out.slice(0, 3)]).toEqual([10, 20, 30])
    expect(out[3]).toBe(Math.round(rampAlpha(1) * 255))
    expect(out[7]).toBeGreaterThan(0)
    expect(out[7]).toBeLessThan(out[3])
    expect(out[11]).toBe(0)
  })

  // Stacking the layers instead would hide whichever team was drawn first.
  it("blends a contested pixel by each team's share of it", () => {
    const out = new Uint8ClampedArray(4)
    colourise([layer([255], PALETTE.A), layer([255], PALETTE.B)], out)

    expect(out[0]).toBe(Math.round((PALETTE.A.r + PALETTE.B.r) / 2))
    expect(out[1]).toBe(Math.round((PALETTE.A.g + PALETTE.B.g) / 2))
  })

  // Relative to the busiest pixel, so a narrow filter still fills the ramp.
  it('measures every pixel against the busiest one, not against saturation', () => {
    const out = new Uint8ClampedArray(2 * 4)
    colourise([layer([40, 20], PALETTE.A)], out)

    expect(out[3]).toBe(Math.round(rampAlpha(1) * 255))
  })

  it('leaves an empty field untouched', () => {
    const out = new Uint8ClampedArray(2 * 4)
    colourise([layer([0, 0], PALETTE.A)], out)

    expect([...out]).toEqual(Array.from({ length: 8 }, () => 0))
  })
})

describe('renderDensity', () => {
  const points: HeatmapPoint[] = [
    { x: 8, y: 4, team: 'A' },
    { x: 9, y: 5, team: 'A' },
    { x: 30, y: 15, team: 'B' },
  ]

  it('costs one stamp per point, and one layer per team', () => {
    const { createCanvas, target, layers } = stubCanvases()
    renderDensity(asContext(target), { points, palette: PALETTE, createCanvas })

    const teamLayers = layers(densitySize('horizontal'))
    expect(teamLayers).toHaveLength(2)
    expect(teamLayers.flatMap((context) => context.drawn)).toHaveLength(points.length)
  })

  // `lighter` would clip: adding into an 8-bit layer saturates wherever a
  // pixel is covered more than about 1/peak times, which is where a
  // whole-match cloud is most interesting.
  it('accumulates the stamps by compositing them', () => {
    const { createCanvas, target, layers } = stubCanvases()
    renderDensity(asContext(target), { points, palette: PALETTE, createCanvas })

    for (const context of layers(densitySize('horizontal'))) {
      expect(context.globalCompositeOperation).toBe('source-over')
    }
  })

  // Six zone spreads, so the stamps are a handful of images however many
  // points are drawn — this is the O(points) claim.
  it('draws each stamp once and blits it', () => {
    const many = Array.from({ length: 2_000 }, (_, index) => ({
      x: index % 40,
      y: index % 20,
      team: 'A' as const,
    }))

    const { createCanvas, target, contexts } = stubCanvases()
    renderDensity(asContext(target), { points: many, palette: PALETTE, createCanvas })

    const size = densitySize('horizontal')
    const stamps = contexts.filter((context) => context.width !== size.width)

    expect(stamps.length).toBeLessThanOrEqual(6)
    expect(stamps.every((stamp) => stamp.stops.length > 0)).toBe(true)
  })

  it('writes the colourised field to the visible canvas once', () => {
    const { createCanvas, target } = stubCanvases((width, height) =>
      new Uint8ClampedArray(width * height * 4).fill(200),
    )
    renderDensity(asContext(target), { points, palette: PALETTE, createCanvas })

    expect(target.cleared).toBe(1)
    expect(target.put).toHaveLength(1)
  })

  it('clears the canvas and stops when there is nothing to draw', () => {
    const { createCanvas, target, contexts } = stubCanvases()
    renderDensity(asContext(target), { points: [], palette: PALETTE, createCanvas })

    expect(target.cleared).toBe(1)
    expect(contexts).toHaveLength(0)
    expect(target.put).toHaveLength(0)
  })

  it('survives an environment that hands out no context at all', () => {
    const target = stubCanvases().target

    expect(() =>
      renderDensity(asContext(target), {
        points,
        palette: PALETTE,
        createCanvas: () => null,
      }),
    ).not.toThrow()
    expect(target.put).toHaveLength(0)
  })
})
