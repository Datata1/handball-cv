import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/ReportTimeline.stories'

const { Default, DurationFromVideo, NoScoreboard, NothingLoaded } =
  composeStories(stories)

/** The share of the lane a bar takes up, as the component wrote it. */
function width(element: HTMLElement) {
  return Number.parseFloat(element.style.inlineSize)
}

describe('ReportTimeline', () => {
  it('lays the four loaded tracks out in one timeline', async () => {
    render(<Default />)

    expect(await screen.findByRole('group', { name: 'Tore' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Ballbesitz' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Spielzüge' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Formationen' })).toBeVisible()
  })

  it('scales a bar against the match length', async () => {
    render(<Default />)
    const bar = await screen.findByRole('button', {
      name: 'Angriff: HSG Nord, 02:00 bis 02:21',
    })

    expect(width(bar)).toBeCloseTo((21 / 2_400) * 100, 5)
  })

  // The read freeze empties the row a match's length comes from, and the
  // element's own metadata is the only other source.
  it('falls back to the video element when the match row carries no length', async () => {
    render(<DurationFromVideo />)
    const bar = await screen.findByRole('button', {
      name: 'Angriff: HSG Nord, 02:00 bis 02:21',
    })

    expect(width(bar)).toBeCloseTo((21 / 2_400) * 100, 5)
  })

  // An empty lane would read as "nobody scored", which is a different claim
  // from "this match has no scoreboard".
  it('draws no goal lane for a match whose scoreboard was never read', async () => {
    render(<NoScoreboard />)

    await screen.findByRole('group', { name: 'Ballbesitz' })
    expect(screen.queryByRole('group', { name: 'Tore' })).not.toBeInTheDocument()
  })

  it('says so when nothing has been detected yet', async () => {
    render(<NothingLoaded />)

    expect(await screen.findByText('Keine Daten')).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByRole('group', { name: 'Tore' })

    await expectNoA11yViolations(container)
  })
})
