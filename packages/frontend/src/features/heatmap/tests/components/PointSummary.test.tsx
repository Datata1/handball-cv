import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/PointSummary.stories'

const { Default, Sparse, Nothing, Loading } = composeStories(stories)

describe('PointSummary', () => {
  it('says how much data the filters selected', async () => {
    render(<Default />)

    expect(
      await screen.findByText('1.240 Positionsmessungen in dieser Auswahl'),
    ).toBeVisible()
  })

  // Legacy explained a thin sample with the SQL that causes it.
  it('warns about a sample too thin to draw, without naming a query', async () => {
    render(<Sparse />)

    expect(
      await screen.findByText('4 Positionsmessungen in dieser Auswahl'),
    ).toBeVisible()
    expect(screen.getByText(/zu wenige Messungen/)).toBeVisible()
    expect(screen.queryByText(/frame_id/)).toBeNull()
  })

  // Unfiltered, a small count is what the match holds, not something to fix.
  it('does not blame a filter that is not set', async () => {
    render(<Sparse filtered={false} />)

    expect(
      await screen.findByText('4 Positionsmessungen in dieser Auswahl'),
    ).toBeVisible()
    expect(screen.queryByText(/zu wenige Messungen/)).toBeNull()
  })

  it('says the selection is empty', async () => {
    render(<Nothing />)

    expect(await screen.findByText('Keine Positionen in dieser Auswahl')).toBeVisible()
  })

  it('announces the wait', () => {
    render(<Loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Sparse />)
    await screen.findByText(/zu wenige Messungen/)

    await expectNoA11yViolations(container)
  })
})
