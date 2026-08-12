import type { NormalisedTeam } from '@/shared/api'

/**
 * One colour per team bucket, for the two things that draw a bucket: a tile's
 * split bar, in Tailwind, and the density canvas, which needs the value itself.
 *
 * The canvas is why the tokens are named here at all — a rasteriser cannot use
 * a class, so the roles are read off the DOM at draw time and the ramp still
 * comes from `tokens.css` rather than from a table of hex in this package.
 */

export const TEAM_TONES: Record<NormalisedTeam, string> = {
  A: 'bg-team-a',
  B: 'bg-team-b',
  U: 'bg-team-u',
}

export const TEAM_TOKENS: Record<NormalisedTeam, string> = {
  A: '--team-a',
  B: '--team-b',
  U: '--team-u',
}

export interface Rgb {
  r: number
  g: number
  b: number
}

export type DensityPalette = Record<NormalisedTeam, Rgb>

function channel(hex: string): number {
  return Number.parseInt(hex, 16)
}

/**
 * A resolved custom property as channels.
 *
 * Only the syntaxes the palette is written in — hex, and `rgb()` with plain
 * numbers. A token in another colour space parses as `null` and the map is not
 * drawn at all, which is the loud failure; keep `tokens.css` on these two.
 */
export function parseColour(value: string): Rgb | null {
  const text = value.trim().toLowerCase()

  const hex = /^#([0-9a-f]{3,8})$/.exec(text)?.[1]
  if (hex !== undefined) {
    if (hex.length === 3 || hex.length === 4) {
      const digits = [...hex.slice(0, 3)].map((digit) => channel(digit + digit))
      return { r: digits[0], g: digits[1], b: digits[2] }
    }

    if (hex.length === 6 || hex.length === 8) {
      return {
        r: channel(hex.slice(0, 2)),
        g: channel(hex.slice(2, 4)),
        b: channel(hex.slice(4, 6)),
      }
    }

    return null
  }

  const rgb = /^rgba?\(([^)]+)\)$/.exec(text)?.[1]
  if (rgb !== undefined) {
    const parts = rgb
      .split(/[\s,/]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(Number)

    if (parts.length === 3 && parts.every(Number.isFinite)) {
      return { r: parts[0], g: parts[1], b: parts[2] }
    }
  }

  return null
}

/**
 * The three team roles as the element sees them, so a court inside a dark
 * subtree draws in that scheme's palette without being told which one it is in.
 */
export function readDensityPalette(element: Element): DensityPalette | null {
  const styles = getComputedStyle(element)

  const a = parseColour(styles.getPropertyValue(TEAM_TOKENS.A))
  const b = parseColour(styles.getPropertyValue(TEAM_TOKENS.B))
  const u = parseColour(styles.getPropertyValue(TEAM_TOKENS.U))

  return a === null || b === null || u === null ? null : { A: a, B: b, U: u }
}
