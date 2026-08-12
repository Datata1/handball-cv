import type { CreateCanvas } from '../density'

/**
 * Enough of a 2D context to observe what the renderer asks a rasteriser for.
 *
 * jsdom has no canvas, and pixels are the one thing worth asserting least: what
 * matters is that each point costs one `drawImage` into an additive layer, and
 * that the stamps are reused. `pixels` is what `getImageData` hands back, so a
 * test can feed the colourisation a layer it chose.
 */
export interface StubContext {
  width: number
  height: number
  canvas: unknown
  globalCompositeOperation: string
  fillStyle: unknown
  pixels: Uint8ClampedArray
  cleared: number
  stops: { offset: number; colour: string }[]
  drawn: { source: unknown; x: number; y: number }[]
  put: { data: Uint8ClampedArray }[]
}

function stubContext(width: number, height: number): StubContext {
  const context: StubContext = {
    width,
    height,
    canvas: { width, height },
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    pixels: new Uint8ClampedArray(width * height * 4),
    cleared: 0,
    stops: [],
    drawn: [],
    put: [],
  }

  return Object.assign(context, {
    clearRect: () => {
      context.cleared += 1
    },
    createRadialGradient: () => ({
      addColorStop: (offset: number, colour: string) => {
        context.stops.push({ offset, colour })
      },
    }),
    fillRect: () => {},
    drawImage: (source: unknown, x: number, y: number) => {
      context.drawn.push({ source, x, y })
    },
    getImageData: () => ({ data: context.pixels }),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    putImageData: (image: { data: Uint8ClampedArray }) => {
      context.put.push(image)
    },
  })
}

export interface StubCanvases {
  createCanvas: CreateCanvas
  /** Every context handed out, in the order the renderer asked for them. */
  contexts: StubContext[]
  /** The layers: one per team, the size of the whole surface. */
  layers: (size: { width: number; height: number }) => StubContext[]
}

/**
 * `pixelsFor` is what `getImageData` will hand back for a canvas of that size —
 * a test that wants the colourisation to do real work supplies a filled buffer,
 * and supplies it *before* anything it is timing.
 */
export function stubCanvases(
  pixelsFor?: (width: number, height: number) => Uint8ClampedArray,
): StubCanvases & { target: StubContext } {
  const contexts: StubContext[] = []

  const createCanvas: CreateCanvas = (width, height) => {
    const context = stubContext(width, height)
    if (pixelsFor !== undefined) context.pixels = pixelsFor(width, height)
    contexts.push(context)

    return context as unknown as CanvasRenderingContext2D
  }

  const target = stubContext(1, 1)

  return {
    createCanvas,
    contexts,
    target,
    layers: (size) =>
      contexts.filter(
        (context) => context.width === size.width && context.height === size.height,
      ),
  }
}

/** A stand-in context as the renderer's parameter type wants it. */
export function asContext(context: unknown): CanvasRenderingContext2D {
  return context as CanvasRenderingContext2D
}
