import { composeStories } from '@storybook/react-vite'
import { render, screen, within } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/DensityMap.stories'

const { Default, SingleTeam, Nothing } = composeStories(stories)

/**
 * jsdom has no rasteriser, so what is asserted here is everything around the
 * pixels: that the drawing is named, that it describes itself in words, and
 * that the canvas itself stays out of the accessibility tree.
 */
describe('DensityMap', () => {
  it('names the drawing by what it is a drawing of', async () => {
    render(<Default />)

    expect(
      await screen.findByRole('img', {
        name: 'Verteilung von 1.240 gemessenen Spielerpositionen auf dem Spielfeld',
      }),
    ).toBeInTheDocument()
  })

  // A canvas reaches no screen reader at all, and the tiles cannot stand in for
  // it: they summarise the whole match and take none of these filters.
  it('describes the cloud in words, by zone', async () => {
    const { container } = render(<Default />)

    const caption = container.querySelector('figcaption')
    expect(caption).not.toBeNull()
    if (caption === null) return

    expect(within(caption).getByText(/1\.240 gemessene Positionen/)).toBeInTheDocument()
    expect(within(caption).getAllByRole('listitem')).toHaveLength(4)
    expect(within(caption).getByText(/Kachelansicht/)).toBeInTheDocument()
  })

  it('says how much of the cloud each team contributed', async () => {
    render(<SingleTeam />)

    expect(await screen.findByText('HSG Nord: 880')).toBeInTheDocument()
    expect(screen.queryByText(/TV Süd/)).toBeNull()
  })

  it('keeps the canvas out of the accessibility tree', () => {
    const { container } = render(<Default />)
    const canvas = container.querySelector('canvas')

    expect(canvas?.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  // The legacy view seeded blobs at the hardcoded zone centres when it had no
  // points, which drew a heatmap of nothing.
  it('draws nothing at all when nothing was measured', () => {
    const { container } = render(<Nothing />)

    expect(container.querySelector('canvas')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByRole('img')

    await expectNoA11yViolations(container)
  })
})
