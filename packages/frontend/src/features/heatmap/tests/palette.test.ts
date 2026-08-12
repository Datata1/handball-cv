import { parseColour, readDensityPalette, TEAM_TOKENS } from '../palette'

describe('parseColour', () => {
  it.each([
    ['#0f3460', { r: 15, g: 52, b: 96 }],
    ['#FFF', { r: 255, g: 255, b: 255 }],
    ['#1a1a2eff', { r: 26, g: 26, b: 46 }],
    ['rgb(107, 114, 128)', { r: 107, g: 114, b: 128 }],
    ['rgb(107 114 128 / 0.5)', { r: 107, g: 114, b: 128 }],
    ['  #e94560  ', { r: 233, g: 69, b: 96 }],
  ])('reads %s', (value, expected) => {
    expect(parseColour(value)).toEqual(expected)
  })

  // A token in a syntax this cannot read leaves the map undrawn rather than
  // drawn in the wrong colour, which is why every one of these is null.
  it.each(['', 'oklch(0.5 0.1 20)', 'var(--primary)', '#12', 'rgb(50%, 20%, 10%)'])(
    'refuses %s',
    (value) => {
      expect(parseColour(value)).toBeNull()
    },
  )
})

describe('readDensityPalette', () => {
  it('reads the three team roles off the element', () => {
    const element = document.createElement('div')
    element.style.setProperty(TEAM_TOKENS.A, '#0f3460')
    element.style.setProperty(TEAM_TOKENS.B, '#c1223f')
    element.style.setProperty(TEAM_TOKENS.U, '#6b7280')
    document.body.append(element)

    expect(readDensityPalette(element)).toEqual({
      A: { r: 15, g: 52, b: 96 },
      B: { r: 193, g: 34, b: 63 },
      U: { r: 107, g: 114, b: 128 },
    })
  })

  it('reports a palette it could not read, rather than inventing one', () => {
    const element = document.createElement('div')
    document.body.append(element)

    expect(readDensityPalette(element)).toBeNull()
  })
})
