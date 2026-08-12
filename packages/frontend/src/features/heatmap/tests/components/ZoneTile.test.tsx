import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/ZoneTile.stories'

const { Dominant, Quiet, Silent } = composeStories(stories)

describe('ZoneTile', () => {
  // Colour is emphasis; the tile has to be readable as data without it.
  it('writes out the zone, its intensity and every team’s count', async () => {
    render(<Dominant />)

    expect(await screen.findByText('Linksaußen')).toBeVisible()
    expect(screen.getByText('100 % der stärksten Zone')).toBeVisible()
    expect(screen.getByText('HSG Nord: 1.820')).toBeVisible()
    expect(screen.getByText('TV Süd: 90')).toBeVisible()
    expect(screen.getByText('Ohne Teamzuordnung: 40')).toBeVisible()
  })

  it('flips the value to the fill’s foreground once the fill is strong', async () => {
    render(<Dominant />)

    expect(await screen.findByText('100 % der stärksten Zone')).toHaveClass(
      'text-primary-foreground',
    )
  })

  it('keeps the card’s foreground on a quiet tile', async () => {
    render(<Quiet />)

    expect(await screen.findByText('22 % der stärksten Zone')).toHaveClass(
      'text-card-foreground',
    )
  })

  // A zone in the response with nothing in it is a measurement, not a gap.
  it('says a zone was empty rather than drawing a split of nothing', async () => {
    render(<Silent />)

    expect(
      await screen.findByText('In dieser Zone wurde niemand erkannt.'),
    ).toBeVisible()
    expect(screen.queryByText(/HSG Nord/)).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Dominant />)
    await screen.findByText('Linksaußen')

    await expectNoA11yViolations(container)
  })
})
