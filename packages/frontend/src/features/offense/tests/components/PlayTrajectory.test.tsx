import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/PlayTrajectory.stories'

const { Default, Centroid, NoDetails, UnusableDetails } = composeStories(stories)

/** The court is one `role="img"`; its caption is the text alternative. */
function court() {
  return screen.getByRole('img', { name: /Laufwege/ })
}

describe('PlayTrajectory', () => {
  it('draws one polyline per track on the shared court', async () => {
    const { container } = render(<Default />)

    await screen.findByRole('img', { name: 'Laufwege: Kreuzen, HSG Nord' })
    expect(container.querySelectorAll('polyline')).toHaveLength(2)
  })

  // A fourth court implementation is what this PR exists to avoid: the court
  // markings belong to `@/shared/court`, and only the data layer is drawn here.
  it('draws no court markings of its own', () => {
    const { container } = render(<Default />)

    expect(container.querySelectorAll('svg')).toHaveLength(1)
    expect(court()).toBe(container.querySelector('svg'))
  })

  it('describes the runs for a reader who cannot see them', async () => {
    render(<Default />)

    expect(await screen.findByText(/2 Laufwege, 01:58 bis 02:11/)).toBeInTheDocument()
    expect(
      screen.getByText('Track 3: von 14,2 m / 6,8 m nach 8,1 m / 14,6 m'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Tor bei 0 m/)).toBeInTheDocument()
  })

  // `track_id === -1` is a mean over the team. Drawing it like a player would
  // put a run on the court that nobody made.
  it('names and dashes the team centroid rather than passing it off as a player', () => {
    const { container } = render(<Centroid />)

    expect(screen.getAllByText('Teamschwerpunkt').length).toBeGreaterThan(0)
    expect(screen.queryByText('Track -1')).toBeNull()
    expect(container.querySelector('polyline')).toHaveAttribute('stroke-dasharray')
  })

  it('marks the goal the attack was aimed at', () => {
    render(<Default />)

    expect(screen.getByText('Angegriffenes Tor')).toBeVisible()
  })

  it('says so when an event carries no trajectories', () => {
    render(<NoDetails />)

    expect(
      screen.getByText('Für diese Szene sind keine Laufwege gespeichert.'),
    ).toBeVisible()
    expect(screen.queryByRole('img')).toBeNull()
  })

  // `details` is `dict[str, Any]` server-side, so its shape is a convention and
  // not a contract.
  it('survives details in a shape it cannot draw', () => {
    render(<UnusableDetails />)

    expect(
      screen.getByText('Für diese Szene sind keine Laufwege gespeichert.'),
    ).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByRole('img', { name: 'Laufwege: Kreuzen, HSG Nord' })

    await expectNoA11yViolations(container)
  })
})
