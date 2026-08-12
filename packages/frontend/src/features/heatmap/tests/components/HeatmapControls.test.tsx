import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/HeatmapControls.stories'

const { Default, OffenseOnly, PhaseSelected, Tiles } = composeStories(stories)

describe('HeatmapControls', () => {
  it('marks the view and the perspective that are active', async () => {
    render(<OffenseOnly />)

    expect(await screen.findByRole('button', { name: 'Dichte' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Angriff' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('reports the view that was chosen', async () => {
    const user = userEvent.setup()
    const onModeChange = fn()
    render(<Default onModeChange={onModeChange} />)

    await user.click(await screen.findByRole('button', { name: 'Kacheln' }))

    expect(onModeChange).toHaveBeenCalledExactlyOnceWith('tiles')
  })

  it('reports the perspective that was chosen', async () => {
    const user = userEvent.setup()
    const onPerspectiveChange = fn()
    render(<Default onPerspectiveChange={onPerspectiveChange} />)

    await user.click(await screen.findByRole('button', { name: 'Abwehr' }))

    expect(onPerspectiveChange).toHaveBeenCalledExactlyOnceWith('defense')
  })

  // The tiles come from `/stats`, which summarises the whole match and takes no
  // parameters. Legacy left the controls on screen doing nothing.
  it('hides the filters the tile view cannot apply', async () => {
    render(<Tiles />)

    expect(await screen.findByRole('button', { name: 'Kacheln' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Angriff' })).toBeNull()
    expect(screen.queryByText('HSG Nord Angriff')).toBeNull()
  })

  // The shared timeline is the phase picker; there is no second select here.
  it('names the active phase and offers a way out of it', async () => {
    const user = userEvent.setup()
    const onClearPhase = fn()
    render(<PhaseSelected onClearPhase={onClearPhase} />)

    expect(
      await screen.findByText('HSG Nord Angriff (02:00–02:21)'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Phase aufheben' }))

    expect(onClearPhase).toHaveBeenCalledOnce()
  })

  it('says where a phase comes from while none is chosen', async () => {
    render(<Default />)

    expect(await screen.findByText('Ganzes Spiel')).toBeInTheDocument()
    expect(screen.getByText(/Zeitleiste/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Phase aufheben' })).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<PhaseSelected />)
    await screen.findByRole('button', { name: 'Dichte' })

    await expectNoA11yViolations(container)
  })
})
