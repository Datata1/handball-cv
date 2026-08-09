import { composeStories } from '@storybook/react-vite'
import { render, renderHook, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import { COURT_WIDTH_M } from '../geometry'
import { createCourtProjection, useCourtProjection } from '../projection'
import * as stories from '../stories/Court.stories'
import { courtZone } from '../zones'

const { Empty, Vertical, Zones, ZonesVertical, Points, PointsVertical, Trajectories } =
  composeStories(stories)

function courtSvg(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg')
  if (svg === null) throw new Error('no court rendered')
  return svg
}

describe('Court', () => {
  it('names itself even with nothing drawn on it', () => {
    render(<Empty />)

    expect(screen.getByRole('img', { name: 'Handballfeld' })).toBeInTheDocument()
  })

  it('takes its name from the data a consumer draws', () => {
    render(<Points />)

    expect(
      screen.getByRole('img', { name: 'Positionen im Abwehrverbund' }),
    ).toBeInTheDocument()
  })

  it('scales through the viewBox rather than a pixel size', () => {
    const { container } = render(<Empty />)
    const svg = courtSvg(container)

    expect(svg.getAttribute('viewBox')).toBe('-1.5 -1.5 43 23')
    expect(svg.getAttribute('width')).toBeNull()
    expect(svg.getAttribute('height')).toBeNull()
  })

  it('reframes rather than rescales when turned', () => {
    const { container } = render(<Vertical />)

    expect(courtSvg(container).getAttribute('viewBox')).toBe('-1.5 -1.5 23 43')
  })

  it('labels the zone overlay in German, from the backend codes', () => {
    render(<Zones />)

    expect(screen.getAllByText('Kreisläufer')).toHaveLength(2)
    expect(screen.getAllByText('Rückraum Mitte')).toHaveLength(2)
  })

  it('leaves zone labels upright when the court is turned', () => {
    const { container } = render(<ZonesVertical />)
    const label = screen.getAllByText('Kreisläufer')[0]

    // Zone labels sit outside the rotating layer and carry the projected
    // position themselves, so the rotation never reaches the glyphs.
    expect(label.closest('[transform]')).toBeNull()
    expect(courtSvg(container)).toContainElement(label)
  })

  it.each(['horizontal', 'vertical'] as const)(
    'positions a zone label at its projected centre, %s',
    (orientation) => {
      render(orientation === 'horizontal' ? <Zones /> : <ZonesVertical />)

      const { toX, toY } = createCourtProjection(orientation)
      const { centre } = courtZone('left', 'KL')
      const label = screen.getAllByText('Kreisläufer')[0]

      expect(Number(label.getAttribute('x'))).toBeCloseTo(toX(centre), 10)
      expect(Number(label.getAttribute('y'))).toBeGreaterThan(toY(centre))
    },
  )

  it.each([
    ['horizontal', <Points key="h" />, null],
    [
      'vertical',
      <PointsVertical key="v" />,
      `translate(${COURT_WIDTH_M} 0) rotate(90)`,
    ],
  ])(
    'leaves a %s layer in court metres and turns the group',
    (_name, ui, transform) => {
      const { container } = render(ui)
      // The first sample point, still carrying the metres the story wrote.
      const dot = courtSvg(container).querySelector('circle[cx="6.5"]')

      expect(dot?.getAttribute('cy')).toBe('4.2')
      expect(dot?.closest('g')?.getAttribute('transform') ?? null).toBe(transform)
    },
  )

  it('describes a data layer for readers who cannot see it', () => {
    render(<Trajectories />)

    expect(screen.getByText(/^Track 12:/)).toBeInTheDocument()
    expect(screen.getByText(/^Track 7:/)).toBeInTheDocument()
  })

  it('refuses to project outside a court', () => {
    expect(() => renderHook(() => useCourtProjection())).toThrow(
      /must be used inside a <Court>/,
    )
  })

  it.each([
    ['empty', <Empty key="empty" />],
    ['with zones', <Zones key="zones" />],
    ['with a data layer', <Trajectories key="tracks" />],
  ])('has no accessibility violations %s', async (_name, ui) => {
    const { container } = render(ui)

    await expectNoA11yViolations(container)
  })
})
