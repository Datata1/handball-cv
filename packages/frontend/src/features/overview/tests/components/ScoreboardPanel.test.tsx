import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/ScoreboardPanel.stories'

const { Default, NoFinalScore, NoScoreboard, Loading, Frozen } = composeStories(stories)

describe('ScoreboardPanel', () => {
  it('shows the final score and the clock it was read at', async () => {
    render(<Default />)

    expect(await screen.findByText('5 : 3')).toBeVisible()
    expect(screen.getByText('Endstand bei Spielzeit 40:00')).toBeVisible()
  })

  // The endpoint 404s for a match it has no readings for, and the query turns
  // that into `null`. "No scoreboard" is a fact about the video.
  it('treats a match with no readings as empty rather than broken', async () => {
    render(<NoScoreboard />)

    expect(await screen.findByText('Keine Anzeigetafel erkannt')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows no score at all when no reading carried both', async () => {
    render(<NoFinalScore />)

    expect(await screen.findByText('Kein Endstand erkannt')).toBeVisible()
    expect(screen.queryByText(/^\d+ : \d+$/)).not.toBeInTheDocument()
  })

  // The goals were read even though the final score was not, so they stay.
  it('still lists the goals it does have', async () => {
    render(<NoFinalScore />)

    expect(
      await screen.findByRole('button', { name: 'Spielzeit 02:18, Heim, 1:0' }),
    ).toBeVisible()
  })

  it('announces the wait while the summary is in flight', () => {
    render(<Loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('reads a 404 during ingestion as "not yet", not "not found"', async () => {
    render(<Frozen />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Noch nicht verfügbar')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByText('5 : 3')

    await expectNoA11yViolations(container)
  })
})
