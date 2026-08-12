import type { HeatmapPoint, NormalisedTeam } from '@/shared/api'
import {
  COURT_MARGIN_M,
  type CourtOrientation,
  courtViewBoxSize,
  createCourtProjection,
  zoneAt,
} from '@/shared/court'

import type { DensityPalette, Rgb } from './palette'
import { TEAM_BUCKETS } from './tiles'

/**
 * The density map as arithmetic: where each measured position lands on a pixel
 * surface, how far it spreads, and what colour the accumulated intensity takes.
 *
 * The cost is **one stamp per point**, not one pass per grid cell — the legacy
 * view summed a Gaussian over ~45 000 splats for each of 966 cells, ~44 million
 * iterations on the main thread on every filter change, and then drew the
 * splats again as SVG circles under a blur. Here the rasteriser accumulates the
 * splats and a single pixel pass turns the accumulation into colour.
 */

/**
 * Pixels per court metre. The surface is a fixed grid rather than a measured
 * one: blurred blobs upscale cleanly, so the drawing costs the same whatever
 * size the container gives it, and nothing here has to read layout.
 */
export const PX_PER_M = 20

/**
 * A point spreads over its zone's spread, narrowed to about a player's own
 * width. The bare spreads are the radius a zone *summary* is drawn at, which is
 * far too wide for a single measurement: 12 000 of them at that size put more
 * ink on the court than the court has room for.
 */
export const RADIUS_SCALE = 1.2

const STAMP_SIGMA = 0.35
const STAMP_STOPS = 6

/**
 * Alpha at the centre of one stamp, which has to fall as the cloud grows.
 *
 * A layer holds 8 bits per pixel however it is accumulated, so a fixed alpha
 * either wastes the range on a handful of points or drives a whole-match cloud
 * to fully opaque everywhere — and a map that is uniformly hot is a map of
 * nothing. Tied to the count, the busiest pixel lands near the top of the range
 * whether the filters selected forty points or twelve thousand.
 */
export const PEAK_INK = 120
export const MIN_PEAK = 0.015
export const MAX_PEAK = 0.6

export function stampPeak(count: number): number {
  if (count <= 0) return MAX_PEAK

  return Math.min(MAX_PEAK, Math.max(MIN_PEAK, PEAK_INK / count))
}

/** Below this share of the busiest pixel, nothing is drawn at all. */
export const ALPHA_FLOOR = 0.04
const ALPHA_MIN = 0.1
const ALPHA_MAX = 0.8
/** < 1, so the quiet end of the ramp separates instead of crushing into it. */
const ALPHA_GAMMA = 0.6

export interface DensitySize {
  width: number
  height: number
}

export interface DensityPoint {
  /** Pixels from the surface's left edge, margin included. */
  x: number
  y: number
  /** Stamp radius in pixels. */
  radius: number
  team: NormalisedTeam
}

export interface StampStop {
  offset: number
  alpha: number
}

/** One team's accumulated stamps. Only the alpha channel carries the intensity. */
export interface DensityLayer {
  pixels: Uint8ClampedArray
  colour: Rgb
}

/** A 2D context, or nothing where the environment has no rasteriser at all. */
export type CreateCanvas = (
  width: number,
  height: number,
) => CanvasRenderingContext2D | null

/** The pixel surface for a court, matching the `viewBox` its `<Court>` draws in. */
export function densitySize(orientation: CourtOrientation = 'horizontal'): DensitySize {
  const { width, height } = courtViewBoxSize(orientation)

  return {
    width: Math.round(width * PX_PER_M),
    height: Math.round(height * PX_PER_M),
  }
}

/**
 * Court metres to surface pixels, through the same projection the SVG uses — so
 * a point sits where the court beneath it says it does, in either orientation.
 *
 * Positions outside the lines are left where they are rather than clamped onto
 * the sideline: a measurement off the court is off the court.
 */
export function projectPoints(
  points: readonly HeatmapPoint[],
  orientation: CourtOrientation = 'horizontal',
): DensityPoint[] {
  const { toX, toY } = createCourtProjection(orientation)

  return points.map((point) => ({
    x: (toX(point) + COURT_MARGIN_M) * PX_PER_M,
    y: (toY(point) + COURT_MARGIN_M) * PX_PER_M,
    // Whole pixels: the radius is also the key a stamp image is cached under,
    // and an image cannot be placed at half the size it was drawn.
    radius: Math.round(zoneAt(point).spread * RADIUS_SCALE * PX_PER_M),
    team: point.team,
  }))
}

/**
 * One stamp's falloff: a Gaussian, shifted so it actually reaches zero at the
 * rim. An unshifted curve leaves every stamp with a visible disc edge once a
 * few of them overlap.
 */
export function stampStops(peak: number): StampStop[] {
  const rim = Math.exp(-1 / (2 * STAMP_SIGMA ** 2))

  return Array.from({ length: STAMP_STOPS }, (_, index) => {
    const offset = index / (STAMP_STOPS - 1)
    const gaussian = Math.exp(-(offset ** 2) / (2 * STAMP_SIGMA ** 2))

    return {
      offset,
      alpha: peak * Math.max(0, (gaussian - rim) / (1 - rim)),
    }
  })
}

/** The square a stamp of this radius is drawn into. */
export function stampSize(radius: number): number {
  return Math.max(1, Math.ceil(radius * 2))
}

/** One reusable stamp, drawn once and blitted per point. */
export function createStamp(
  radius: number,
  peak: number,
  createCanvas: CreateCanvas,
): CanvasRenderingContext2D | null {
  const size = stampSize(radius)
  const ctx = createCanvas(size, size)
  if (ctx === null) return null

  const centre = size / 2
  const gradient = ctx.createRadialGradient(centre, centre, 0, centre, centre, centre)

  for (const stop of stampStops(peak)) {
    gradient.addColorStop(stop.offset, `rgba(255, 255, 255, ${stop.alpha})`)
  }

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  return ctx
}

/**
 * Every point of one team, accumulated into a layer. Letting the rasteriser
 * accumulate the stamps is the whole technique: the intensity field falls out
 * of drawing rather than out of a loop over cells.
 *
 * Ordinary alpha compositing rather than `lighter`, which is what a heatmap is
 * usually built from: adding into an 8-bit layer clips hard once a pixel is
 * covered more than about `1 / peak` times, and the hot spots of a whole-match
 * cloud would merge into one flat plateau at exactly the intensities the map
 * exists to separate. Compositing approaches opacity instead of hitting it.
 */
export function stampPoints(
  ctx: CanvasRenderingContext2D,
  points: readonly DensityPoint[],
  stampFor: (radius: number) => CanvasImageSource | null,
): void {
  ctx.globalCompositeOperation = 'source-over'

  for (const point of points) {
    const stamp = stampFor(point.radius)
    if (stamp === null) continue

    const size = stampSize(point.radius)
    ctx.drawImage(stamp, point.x - size / 2, point.y - size / 2)
  }
}

/**
 * How opaque a pixel is, given its share of the busiest one. Relative, so a
 * narrow filter still fills the ramp instead of fading out with its own count.
 */
export function rampAlpha(intensity: number): number {
  const clamped = Math.min(1, Math.max(0, intensity))
  if (clamped <= ALPHA_FLOOR) return 0

  const scaled = (clamped - ALPHA_FLOOR) / (1 - ALPHA_FLOOR)

  return ALPHA_MIN + (ALPHA_MAX - ALPHA_MIN) * scaled ** ALPHA_GAMMA
}

/**
 * The teams' accumulated layers as one image: colour is the layers' share of
 * the pixel, opacity is the ramp.
 *
 * Blending the shares rather than painting the layers over each other is what
 * keeps a contested area visible as one — stacking them would hide whichever
 * team is drawn first under whichever is drawn last.
 */
export function colourise(
  layers: readonly DensityLayer[],
  out: Uint8ClampedArray,
): void {
  const pixels = Math.floor(out.length / 4)
  // Three saturated layers reach 765, so 16 bits is the whole domain.
  const totals = new Uint16Array(pixels)
  let busiest = 0

  for (let i = 0; i < pixels; i++) {
    let total = 0
    for (const layer of layers) total += layer.pixels[i * 4 + 3]

    totals[i] = total
    if (total > busiest) busiest = total
  }

  if (busiest === 0) return

  for (let i = 0; i < pixels; i++) {
    const total = totals[i]
    if (total === 0) continue

    let r = 0
    let g = 0
    let b = 0

    for (const layer of layers) {
      const share = layer.pixels[i * 4 + 3] / total
      r += share * layer.colour.r
      g += share * layer.colour.g
      b += share * layer.colour.b
    }

    const offset = i * 4
    out[offset] = r
    out[offset + 1] = g
    out[offset + 2] = b
    out[offset + 3] = rampAlpha(total / busiest) * 255
  }
}

const domCanvas: CreateCanvas = (width, height) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  return canvas.getContext('2d')
}

export interface DensityRender {
  points: readonly HeatmapPoint[]
  palette: DensityPalette
  orientation?: CourtOrientation
  /** Injected by the tests; the default makes offscreen canvases in the DOM. */
  createCanvas?: CreateCanvas
}

/** The whole drawing, from court positions to the pixels on the visible canvas. */
export function renderDensity(
  target: CanvasRenderingContext2D,
  render: DensityRender,
): void {
  const {
    points,
    palette,
    orientation = 'horizontal',
    createCanvas = domCanvas,
  } = render
  const { width, height } = densitySize(orientation)

  target.clearRect(0, 0, width, height)
  if (points.length === 0) return

  const projected = projectPoints(points, orientation)

  // Radii come from six zone spreads, so the stamps are a handful of images
  // however many points there are.
  const peak = stampPeak(points.length)
  const stamps = new Map<number, CanvasImageSource | null>()
  const stampFor = (radius: number) => {
    if (!stamps.has(radius)) {
      stamps.set(radius, createStamp(radius, peak, createCanvas)?.canvas ?? null)
    }

    return stamps.get(radius) ?? null
  }

  const layers: DensityLayer[] = []

  for (const team of TEAM_BUCKETS) {
    const own = projected.filter((point) => point.team === team)
    if (own.length === 0) continue

    const layer = createCanvas(width, height)
    if (layer === null) continue

    stampPoints(layer, own, stampFor)
    layers.push({
      pixels: layer.getImageData(0, 0, width, height).data,
      colour: palette[team],
    })
  }

  if (layers.length === 0) return

  const image = target.createImageData(width, height)
  colourise(layers, image.data)
  target.putImageData(image, 0, 0)
}
