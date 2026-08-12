import { readTokens, type Tokens } from '@/styles/contrast'
import css from '@/styles/tokens.css?raw'

/**
 * `tokens.css` as two resolved palettes, one per colour scheme, for the tests
 * that check contrast.
 *
 * As text rather than through the DOM on purpose: jsdom resolves no custom
 * property and computes no colour, so the stylesheet is the only place the
 * values exist at test time.
 */

const light = readTokens(css, ':root')

/** The dark block overrides roles; anything it leaves alone stays as declared. */
const dark: Tokens = new Map([...light, ...readTokens(css, '\\.dark')])

export const SCHEMES: readonly (readonly [string, Tokens])[] = [
  ['light', light],
  ['dark', dark],
]
