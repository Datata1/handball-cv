import { SCHEMES } from '@/testing/tokens'

import { contrast, resolve, type Tokens } from '../contrast'

/**
 * The contrast audit, as a test rather than a spreadsheet.
 *
 * axe cannot do this: jsdom computes no rendered colour, so `color-contrast` is
 * off in `src/testing/axe.ts` and Storybook's a11y panel only ever sees the
 * scheme the browser is in. Both schemes are in this file instead, and a token
 * changed to something unreadable fails here rather than in a screenshot
 * somebody remembered to take.
 *
 * The pairs are the ones components actually compose — every `text-x on bg-y`
 * in `src/`, plus the marks that sit on `--muted`, which is the court surface
 * and the timeline's track background.
 */

/** WCAG 1.4.3: body text. */
const TEXT = 4.5
/** WCAG 1.4.11: a mark, a border, a focus ring — anything not read as text. */
const GRAPHIC = 3

const PAIRS: readonly [string, string, number][] = [
  ['--foreground', '--background', TEXT],
  ['--card-foreground', '--card', TEXT],
  ['--muted-foreground', '--background', TEXT],
  ['--muted-foreground', '--card', TEXT],
  ['--muted-foreground', '--muted', TEXT],
  ['--primary', '--background', TEXT],
  ['--primary', '--card', TEXT],
  ['--primary-foreground', '--primary', TEXT],
  ['--secondary-foreground', '--secondary', TEXT],
  ['--accent-foreground', '--accent', TEXT],
  ['--destructive', '--background', TEXT],
  ['--destructive', '--card', TEXT],
  ['--destructive-foreground', '--destructive', TEXT],
  ['--chrome-foreground', '--chrome', TEXT],

  // The ring has to be findable on every surface it can appear over, including
  // the navy header, which does not follow the colour scheme.
  ['--ring', '--background', GRAPHIC],
  ['--ring', '--card', GRAPHIC],
  ['--ring', '--muted', GRAPHIC],
  ['--ring', '--chrome', GRAPHIC],

  // Status dots sit on a card, and each tints a written label rather than
  // replacing it — but a dot nobody can see is not worth drawing either.
  ['--status-done', '--card', GRAPHIC],
  ['--status-processing', '--card', GRAPHIC],
  ['--status-failed', '--card', GRAPHIC],
  ['--status-unknown', '--card', GRAPHIC],

  // Team fills: timeline bars and heatmap swatches on --muted, legend dots on
  // the page. --team-foreground is the label written on all three.
  ['--team-a', '--muted', GRAPHIC],
  ['--team-b', '--muted', GRAPHIC],
  ['--team-u', '--muted', GRAPHIC],
  ['--team-a', '--background', GRAPHIC],
  ['--team-b', '--background', GRAPHIC],
  ['--team-u', '--background', GRAPHIC],
  ['--team-foreground', '--team-a', TEXT],
  ['--team-foreground', '--team-b', TEXT],
  ['--team-foreground', '--team-u', TEXT],

  // Chart series: trajectory strokes and the goal rectangle on the court, which
  // is --muted, and bars on the page.
  ['--chart-1', '--muted', GRAPHIC],
  ['--chart-2', '--muted', GRAPHIC],
  ['--chart-3', '--muted', GRAPHIC],
  ['--chart-4', '--muted', GRAPHIC],
  ['--chart-5', '--muted', GRAPHIC],
  ['--chart-1', '--background', GRAPHIC],
  ['--chart-2', '--background', GRAPHIC],
  ['--chart-3', '--background', GRAPHIC],
  ['--chart-4', '--background', GRAPHIC],
  ['--chart-5', '--background', GRAPHIC],
]

describe.each(SCHEMES)('%s scheme', (_scheme, tokens: Tokens) => {
  it.each(PAIRS)('%s on %s reaches %d:1', (foreground, background, minimum) => {
    const ratio = contrast(resolve(tokens, foreground), resolve(tokens, background))

    expect(Number(ratio.toFixed(2))).toBeGreaterThanOrEqual(minimum)
  })
})
