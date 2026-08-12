import { contrast, mix, resolve, type Tokens } from '@/styles/contrast'
import { SCHEMES } from '@/testing/tokens'

import { FILL_MIN, INVERT_AT, tileFill } from '../tiles'

/**
 * The tile ramp is the one place in the app where text sits on a computed
 * colour, so no fixed pair of tokens can be checked instead: every intensity
 * from 0 to 100 produces its own fill, and the value on it flips to the fill's
 * own foreground at `INVERT_AT`.
 *
 * The bar is 3:1 rather than 4.5 — the value is `text-2xl font-bold`, which is
 * WCAG large text — and the tile's other text stays on the card, where the ramp
 * cannot reach it.
 */

const LARGE_TEXT = 3

/** Both sides of the flip, and the ends of the ramp. */
const INTENSITIES = [0, 1, 25, 50, 60, 61, 62, 63, 75, 99, 100]

describe.each(SCHEMES)('%s scheme tile fill', (_scheme, tokens: Tokens) => {
  it.each(INTENSITIES)('is readable at intensity %d', (intensity) => {
    const fill = tileFill(intensity)
    const backdrop = mix(
      resolve(tokens, '--primary'),
      resolve(tokens, '--card'),
      fill.mix,
    )
    const text = resolve(
      tokens,
      fill.inverted ? '--primary-foreground' : '--card-foreground',
    )

    expect(Number(contrast(text, backdrop).toFixed(2))).toBeGreaterThanOrEqual(
      LARGE_TEXT,
    )
  })

  // The quiet end of the ramp is where the card foreground is safest and the
  // inverted one is unreadable, so a flip that drifted down would show up here.
  it('does not invert at the quiet end of the ramp', () => {
    expect(tileFill(0).mix).toBe(FILL_MIN)
    expect(tileFill(0).inverted).toBe(false)
    expect(INVERT_AT).toBeGreaterThan(FILL_MIN)
  })
})
