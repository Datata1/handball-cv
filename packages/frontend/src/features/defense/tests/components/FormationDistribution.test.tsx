import { composeStories } from '@storybook/react-vite'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/FormationDistribution.stories'

const {
  Default,
  NovelLabels,
  DrilledIn,
  PhaseLabelsOnly,
  NotScored,
  Loading,
  Failed,
  Frozen,
} = composeStories(stories)

describe('FormationDistribution', () => {
  it('shows each team’s shapes, most-used first', async () => {
    render(<Default />)

    expect(await screen.findByRole('heading', { name: 'HSG Nord' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'TV Süd' })).toBeVisible()
    expect(
      screen.getAllByRole('button').map((button) => button.textContent?.slice(0, 3)),
    ).toEqual(['6-0', '5-1', '3-2', '5-1', '6-0'])
  })

  it('states each shape’s share of the frames that were classified', async () => {
    render(<Default />)

    // 18 000 of 27 600 frames left after the phase labels come out.
    expect(await screen.findByText('65 % · 18.000 Frames')).toBeVisible()
    expect(screen.getByText('26 % · 7.200 Frames')).toBeVisible()
  })

  // The GCN + LSTM work changes the label set. A formation the frontend has
  // never heard of has to render as itself.
  it('renders a label no dictionary knows under its own name', async () => {
    render(<NovelLabels />)

    expect(await screen.findByRole('button', { name: /gcn-cluster-7/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /4-2-flex/ })).toBeVisible()
  })

  it('never lists a phase label as a formation', async () => {
    render(<Default />)

    await screen.findByRole('heading', { name: 'HSG Nord' })
    for (const phase of [
      'attack',
      'transition',
      'unknown',
      'Angriff',
      'Umschaltspiel',
    ]) {
      expect(screen.queryByRole('button', { name: new RegExp(phase) })).toBeNull()
    }
  })

  it('reports the formation that was picked', async () => {
    const user = userEvent.setup()
    const onSelect = fn()
    render(<Default onSelect={onSelect} />)

    const teamA = within(await screen.findByRole('region', { name: 'HSG Nord' }))
    await user.click(teamA.getByRole('button', { name: /5-1/ }))

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('A', '5-1')
  })

  it('marks the formation the report is drilled into', async () => {
    render(<DrilledIn />)

    const pressed = await screen.findAllByRole('button', { pressed: true })
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveTextContent('6-0')
  })

  it('says nothing was classified when only phases came back', async () => {
    render(<PhaseLabelsOnly />)

    expect(await screen.findByText('Noch keine Formationen erkannt')).toBeVisible()
  })

  // The legacy copy told the trainer to run `wels-score <id>` themselves.
  it('reads an unscored match as empty, without a command to type', async () => {
    render(<NotScored />)

    expect(await screen.findByText('Noch keine Formationen erkannt')).toBeVisible()
    expect(screen.queryByText(/wels-score/)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
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

  // The same 404 the unscored match answers with, but nothing can be concluded
  // from it while every read is frozen.
  it('reads a 404 during ingestion as "not yet", not "not scored"', async () => {
    render(<Frozen />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Noch nicht verfügbar')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByRole('heading', { name: 'HSG Nord' })

    await expectNoA11yViolations(container)
  })
})
