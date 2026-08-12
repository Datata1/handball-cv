import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/MatchFigures.stories'

const { Default, NoPossession, Unmeasured, Loading, Failed, Frozen } =
  composeStories(stories)

describe('MatchFigures', () => {
  it('shows what was processed', async () => {
    render(<Default />)

    expect(await screen.findByText('60.000')).toBeVisible()
    expect(screen.getByText('40:00')).toBeVisible()
    expect(screen.getByText('34')).toBeVisible()
  })

  // Detection rates diagnose the video, not the handball; they are grouped
  // under their own heading so they cannot be read as match statistics.
  it('groups the detection rates as processing diagnostics', async () => {
    render(<Default />)

    expect(
      await screen.findByRole('heading', { name: 'Verarbeitungsqualität' }),
    ).toBeVisible()
    expect(screen.getByText('71,4 %')).toBeVisible()
    expect(screen.getByText('98,2 %')).toBeVisible()
    expect(screen.getByText('86,5 %')).toBeVisible()
  })

  it('calls tracks tracks', async () => {
    render(<Default />)

    expect(await screen.findByText('Erkannte Tracks')).toBeVisible()
    expect(
      screen.getByText('Ein Spieler kann in mehrere Tracks zerfallen.'),
    ).toBeVisible()
  })

  it('keeps the other figures when possession was never measured', async () => {
    render(<NoPossession />)

    expect(await screen.findByText('Kein Ballbesitz gemessen')).toBeVisible()
    expect(screen.getByText('60.000')).toBeVisible()
  })

  // Every figure in that response is `0.0` because it was divided by no
  // frames. A zero on screen would claim it was measured.
  it('shows no figure at all for a match no frame was read for', async () => {
    render(<Unmeasured />)

    expect(await screen.findAllByText('Keine Daten')).toHaveLength(6)
    expect(screen.queryByText('0 %')).not.toBeInTheDocument()
  })

  it('announces the wait', () => {
    render(<Loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('offers a retry when the request failed', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<Failed onRetry={onRetry} />)

    await user.click(await screen.findByRole('button', { name: 'Erneut versuchen' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('reads a 404 during ingestion as "not yet", not "not found"', async () => {
    render(<Frozen />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Noch nicht verfügbar')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByText('60.000')

    await expectNoA11yViolations(container)
  })
})
