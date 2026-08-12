import { composeStories } from '@storybook/react-vite'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/ZoneTiles.stories'

const { Default, NothingMeasured, Loading, Failed, Frozen } = composeStories(stories)

describe('ZoneTiles', () => {
  it('draws six zones per half, named rather than only coloured', async () => {
    render(<Default />)

    const left = within(
      await screen.findByRole('region', { name: 'Linke Spielfeldhälfte' }),
    )
    const right = within(screen.getByRole('region', { name: 'Rechte Spielfeldhälfte' }))

    for (const zone of [
      'Linksaußen',
      'Rückraum links',
      'Rückraum Mitte',
      'Rückraum rechts',
      'Rechtsaußen',
      'Kreisläufer',
    ]) {
      expect(left.getByText(zone)).toBeVisible()
      expect(right.getByText(zone)).toBeVisible()
    }
  })

  it('states each zone’s intensity as a share of the busiest one', async () => {
    render(<Default />)

    const left = within(
      await screen.findByRole('region', { name: 'Linke Spielfeldhälfte' }),
    )

    expect(left.getByText('100 % der stärksten Zone')).toBeVisible()
    expect(left.getByText('22 % der stärksten Zone')).toBeVisible()
  })

  // The tiles are `/stats`, which has no parameters — a trainer would otherwise
  // set a filter and wonder why nothing moved.
  it('says the tiles cover the whole match', async () => {
    render(<Default />)

    expect(await screen.findByText(/ganze Spiel/)).toBeVisible()
  })

  it('reads an all-zero response as nothing measured', async () => {
    render(<NothingMeasured />)

    expect(await screen.findByText('Noch keine Positionen erkannt')).toBeVisible()
  })

  it('announces the wait', () => {
    render(<Loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('offers a retry when the request failed', async () => {
    const user = userEvent.setup()
    const onRetry = fn()
    render(<Failed onRetry={onRetry} />)

    await user.click(await screen.findByRole('button', { name: 'Erneut versuchen' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })

  // Every read is empty while any match is being ingested, so a 404 here proves
  // nothing about this one.
  it('reads a 404 during ingestion as "not yet"', async () => {
    render(<Frozen />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Noch nicht verfügbar')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByRole('region', { name: 'Linke Spielfeldhälfte' })

    await expectNoA11yViolations(container)
  })
})
