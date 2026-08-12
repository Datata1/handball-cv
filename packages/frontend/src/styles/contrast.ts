/**
 * WCAG contrast arithmetic over the token layer.
 *
 * It lives beside the tokens rather than in the test that uses it because the
 * numbers are a property of `tokens.css`: a colour added there is a colour some
 * component will eventually put text on, and this is what says whether it can.
 *
 * Only the two syntaxes the palette is written in are understood — hex and
 * `rgb()` — plus `var()` chains, which is how every role is defined.
 */

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

export type Tokens = ReadonlyMap<string, string>

/**
 * The declarations of one selector's blocks, in source order, so a later block
 * overrides an earlier one exactly as the cascade would.
 */
export function readTokens(css: string, selector: string): Map<string, string> {
  const tokens = new Map<string, string>()
  const blocks = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'g')

  for (const [, body] of css.matchAll(blocks)) {
    for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      tokens.set(name, value.trim())
    }
  }

  return tokens
}

export function resolve(tokens: Tokens, name: string): Rgba {
  let value = tokens.get(name)

  for (let hops = 0; hops < 10; hops += 1) {
    const reference = /^var\((--[\w-]+)\)$/.exec(value?.trim() ?? '')?.[1]
    if (reference === undefined) break

    value = tokens.get(reference)
  }

  const colour = value === undefined ? null : parseColour(value)
  if (colour === null) throw new Error(`${name} is not a colour this can read`)

  return colour
}

export function parseColour(value: string): Rgba | null {
  const text = value.trim().toLowerCase()

  const hex = /^#([0-9a-f]{3,8})$/.exec(text)?.[1]
  if (hex !== undefined) return fromHex(hex)

  const rgb = /^rgba?\(([^)]+)\)$/.exec(text)?.[1]
  if (rgb === undefined) return null

  const parts = rgb
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number)
  if (parts.length < 3 || !parts.every(Number.isFinite)) return null

  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 }
}

function fromHex(hex: string): Rgba | null {
  if (hex.length === 3 || hex.length === 4) {
    const digits = [...hex].map((digit) => Number.parseInt(digit + digit, 16))
    return { r: digits[0], g: digits[1], b: digits[2], a: (digits[3] ?? 255) / 255 }
  }

  if (hex.length === 6 || hex.length === 8) {
    const pair = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16)
    return {
      r: pair(0),
      g: pair(2),
      b: pair(4),
      a: hex.length === 8 ? pair(6) / 255 : 1,
    }
  }

  return null
}

/** A translucent colour as it is actually seen, which is over something. */
export function over(colour: Rgba, backdrop: Rgba): Rgba {
  if (colour.a === 1) return colour

  const blend = (top: number, bottom: number) =>
    colour.a * top + (1 - colour.a) * bottom

  return {
    r: blend(colour.r, backdrop.r),
    g: blend(colour.g, backdrop.g),
    b: blend(colour.b, backdrop.b),
    a: 1,
  }
}

/** `color-mix(in srgb, colour percent%, backdrop)`, which the tiles fill with. */
export function mix(colour: Rgba, backdrop: Rgba, percent: number): Rgba {
  const share = percent / 100
  const blend = (top: number, bottom: number) => share * top + (1 - share) * bottom

  return {
    r: blend(colour.r, backdrop.r),
    g: blend(colour.g, backdrop.g),
    b: blend(colour.b, backdrop.b),
    a: 1,
  }
}

function luminance({ r, g, b }: Rgba): number {
  const channel = (value: number) => {
    const share = value / 255
    return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2.x contrast, `1`–`21`. The order of the two colours does not matter. */
export function contrast(foreground: Rgba, background: Rgba): number {
  const [lighter, darker] = [
    luminance(over(foreground, background)),
    luminance(background),
  ].sort((a, b) => b - a)

  return (lighter + 0.05) / (darker + 0.05)
}
