import type { HeatmapPoint } from '@/shared/api'
import { COURT_MARGIN_M } from '@/shared/court'

import { densitySize, PX_PER_M, renderDensity } from '../density'
import type { DensityPalette } from '../palette'
import { softwareCanvases } from './software-canvas'
import { asContext } from './stub-canvas'

/**
 * What the drawing actually comes out as, composited by hand — the assertions
 * the pixels would carry, in an environment that has none.
 */

const PALETTE: DensityPalette = {
  A: { r: 15, g: 52, b: 96 },
  B: { r: 193, g: 34, b: 63 },
  U: { r: 107, g: 114, b: 128 },
}

const HOT = { x: 10, y: 6 }

/** Seeded, because a field assertion has to mean the same thing on every run. */
function random(seed: number): () => number {
  let state = seed

  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
}

/** A cluster around one spot, plus a thin scatter over the rest of the court. */
function cloud(count: number): HeatmapPoint[] {
  const next = random(19)

  return Array.from({ length: count }, (_, index) =>
    index % 4 === 0
      ? { x: next() * 40, y: next() * 20, team: 'A' as const }
      : {
          x: HOT.x + (next() - 0.5) * 4,
          y: HOT.y + (next() - 0.5) * 4,
          team: 'A' as const,
        },
  )
}

function field(points: readonly HeatmapPoint[]) {
  const { createCanvas, target } = softwareCanvases()
  renderDensity(asContext(target), { points, palette: PALETTE, createCanvas })

  const { width, height } = densitySize('horizontal')
  const output = target.output
  if (output === null) throw new Error('nothing was drawn')

  let brightest = 0
  let brightestIndex = 0
  let atPeak = 0
  let drawn = 0

  for (let index = 0; index < width * height; index++) {
    const alpha = output[index * 4 + 3]
    if (alpha === 0) continue

    drawn += 1
    if (alpha === 255) atPeak += 1
    if (alpha > brightest) {
      brightest = alpha
      brightestIndex = index
    }
  }

  return {
    drawn,
    atPeak,
    brightest,
    hottest: {
      x: (brightestIndex % width) / PX_PER_M - COURT_MARGIN_M,
      y: Math.floor(brightestIndex / width) / PX_PER_M - COURT_MARGIN_M,
    },
  }
}

describe('the drawn field', () => {
  it('is hottest where the positions actually cluster', () => {
    const { hottest, drawn } = field(cloud(3_000))

    expect(drawn).toBeGreaterThan(0)
    expect(Math.hypot(hottest.x - HOT.x, hottest.y - HOT.y)).toBeLessThan(2)
  })

  // The whole point of thinning the ink as the cloud grows: a map whose hot
  // spots have all run together at the top of the range shows nothing.
  it('does not flatten into one plateau', () => {
    const { drawn, atPeak, brightest } = field(cloud(3_000))

    expect(brightest).toBeLessThan(255)
    expect(atPeak / drawn).toBeLessThan(0.02)
  })

  it('leaves the quiet parts of the court unpainted', () => {
    const { width, height } = densitySize('horizontal')
    const { drawn } = field(cloud(3_000))

    expect(drawn).toBeLessThan(width * height)
  })
})
