import type { CreateCanvas } from '../density'

/**
 * A 2D context implemented in JavaScript, so the field the renderer produces
 * can be inspected where there is no rasteriser.
 *
 * It implements exactly what `renderDensity` uses and nothing else: a radial
 * gradient filled into a square, `drawImage` compositing that square onto a
 * layer, and reading the result back. Compositing is the one rule that matters
 * — `out = src + dst · (1 − src)` on the alpha channel — and `lighter` is
 * deliberately not implemented, so a change back to it fails loudly here rather
 * than quietly flattening the map.
 */

interface Stop {
  offset: number
  alpha: number
}

interface Gradient {
  radius: number
  stops: Stop[]
  addColorStop(offset: number, colour: string): void
}

export interface SoftwareContext {
  width: number
  height: number
  canvas: unknown
  /** Alpha per pixel, 0–1, in row-major order. */
  alpha: Float64Array
  /** What `putImageData` was handed: the colourised RGBA of the whole surface. */
  output: Uint8ClampedArray | null
  globalCompositeOperation: string
  fillStyle: unknown
  clearRect(): void
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): Gradient
  fillRect(x: number, y: number, width: number, height: number): void
  drawImage(source: unknown, x: number, y: number): void
  getImageData(): { data: Uint8ClampedArray }
  createImageData(width: number, height: number): { data: Uint8ClampedArray }
  putImageData(image: { data: Uint8ClampedArray }): void
}

function alphaOf(colour: string): number {
  return Number(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(colour)?.[1] ?? '0')
}

/** The gradient's alpha at a fraction of its radius, interpolated between stops. */
function alphaAt(stops: readonly Stop[], t: number): number {
  if (t >= 1) return 0

  for (let index = 1; index < stops.length; index++) {
    const previous = stops[index - 1]
    const current = stops[index]
    if (t > current.offset) continue

    const span = current.offset - previous.offset
    const share = span === 0 ? 0 : (t - previous.offset) / span

    return previous.alpha + share * (current.alpha - previous.alpha)
  }

  return 0
}

function softwareContext(width: number, height: number): SoftwareContext {
  const context: SoftwareContext = {
    width,
    height,
    canvas: null,
    alpha: new Float64Array(width * height),
    output: null,
    globalCompositeOperation: 'source-over',
    fillStyle: null,

    clearRect: () => {
      context.alpha.fill(0)
    },

    createRadialGradient: (_x0, _y0, _r0, _x1, _y1, radius) => {
      const gradient: Gradient = {
        radius,
        stops: [],
        addColorStop: (offset, colour) => {
          gradient.stops.push({ offset, alpha: alphaOf(colour) })
        },
      }

      return gradient
    },

    fillRect: () => {
      const gradient = context.fillStyle as Gradient
      const centre = context.width / 2

      for (let y = 0; y < context.height; y++) {
        for (let x = 0; x < context.width; x++) {
          const distance = Math.hypot(x + 0.5 - centre, y + 0.5 - centre)
          context.alpha[y * context.width + x] = alphaAt(
            gradient.stops,
            distance / gradient.radius,
          )
        }
      }
    },

    drawImage: (source, x, y) => {
      if (context.globalCompositeOperation !== 'source-over') {
        throw new Error(
          `unimplemented composite mode: ${context.globalCompositeOperation}`,
        )
      }

      const stamp = source as SoftwareContext
      const left = Math.round(x)
      const top = Math.round(y)

      for (let row = 0; row < stamp.height; row++) {
        const destinationY = top + row
        if (destinationY < 0 || destinationY >= context.height) continue

        for (let column = 0; column < stamp.width; column++) {
          const destinationX = left + column
          if (destinationX < 0 || destinationX >= context.width) continue

          const source = stamp.alpha[row * stamp.width + column]
          const index = destinationY * context.width + destinationX
          context.alpha[index] = source + context.alpha[index] * (1 - source)
        }
      }
    },

    getImageData: () => {
      const data = new Uint8ClampedArray(context.width * context.height * 4)
      for (let index = 0; index < context.alpha.length; index++) {
        data[index * 4 + 3] = Math.round(context.alpha[index] * 255)
      }

      return { data }
    },

    createImageData: (imageWidth, imageHeight) => ({
      data: new Uint8ClampedArray(imageWidth * imageHeight * 4),
    }),

    putImageData: (image) => {
      context.output = image.data
    },
  }

  context.canvas = context

  return context
}

export function softwareCanvases(): {
  createCanvas: CreateCanvas
  target: SoftwareContext
} {
  return {
    createCanvas: (width, height) =>
      softwareContext(width, height) as unknown as CanvasRenderingContext2D,
    target: softwareContext(1, 1),
  }
}
