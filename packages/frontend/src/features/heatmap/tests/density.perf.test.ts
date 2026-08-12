import type { HeatmapPoint, NormalisedTeam } from '@/shared/api'
import { COURT_LENGTH_M, COURT_WIDTH_M } from '@/shared/court'

import { densitySize, renderDensity } from '../density'
import type { DensityPalette } from '../palette'
import { asContext, stubCanvases } from './stub-canvas'

/**
 * The performance claim of this view, asserted.
 *
 * `/heatmap-points` caps at 12 000 points, and the legacy view turned those
 * into ~45 000 splats and then summed a Gaussian over all of them for each of
 * 966 grid cells — tens of millions of iterations, synchronously, on every
 * filter change. Measured here is everything except the rasteriser itself,
 * which jsdom does not have: the projection, the per-point stamping loop and
 * the colourisation pass over every pixel of the surface. Those are the parts
 * that would grow again if the grid ever came back.
 */

/**
 * Deliberately loose: the run is ~20ms on an idle machine and ~50ms with the
 * rest of the suite competing for the core, and what this has to catch is an
 * algorithmic regression, which costs seconds rather than milliseconds.
 */
const BUDGET_MS = 120
const POINTS = 12_000

const PALETTE: DensityPalette = {
  A: { r: 15, g: 52, b: 96 },
  B: { r: 193, g: 34, b: 63 },
  U: { r: 107, g: 114, b: 128 },
}

const TEAMS: NormalisedTeam[] = ['A', 'B', 'U']

function cloud(count: number): HeatmapPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    x: (index * 7.31) % COURT_LENGTH_M,
    y: (index * 3.17) % COURT_WIDTH_M,
    team: TEAMS[index % TEAMS.length] ?? 'U',
  }))
}

describe('density rendering cost', () => {
  it(`draws ${POINTS.toLocaleString('de-DE')} points in under ${BUDGET_MS}ms`, () => {
    const points = cloud(POINTS)
    const { width, height } = densitySize('horizontal')

    // A layer with intensity in every pixel, so the colourisation does its full
    // work rather than skipping empty ones. Built once, up front: allocating it
    // is the test's cost, not the renderer's.
    const filled = new Uint8ClampedArray(width * height * 4)
    for (let index = 3; index < filled.length; index += 4) filled[index] = index % 255

    const draw = () => {
      const { createCanvas, target } = stubCanvases(() => filled)
      renderDensity(asContext(target), { points, palette: PALETTE, createCanvas })

      return target
    }

    // The first pass through any of this is the compiler warming up, which is
    // not what the budget is about.
    draw()

    const started = performance.now()
    const target = draw()
    const elapsed = performance.now() - started

    expect(target.put).toHaveLength(1)
    expect(elapsed).toBeLessThan(BUDGET_MS)
  })
})
