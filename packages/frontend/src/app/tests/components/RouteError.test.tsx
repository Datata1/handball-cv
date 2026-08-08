import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/RouteError.stories'

const { Unreachable, NotFound, Frozen, BadSearchParams } = composeStories(stories)

describe('RouteError', () => {
  it('renders German copy for a dead connection', () => {
    render(<Unreachable />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Der Server ist nicht erreichbar.',
    )
  })

  it('reads a 404 as absence once the match list rules out an ingest', () => {
    render(<NotFound />)

    expect(screen.getByRole('alert')).toHaveTextContent('Nicht gefunden.')
  })

  it('reads the same 404 as "not yet" while a match is processing', () => {
    render(<Frozen />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Noch nicht verfügbar')
    expect(alert).not.toHaveTextContent('Nicht gefunden.')
  })

  it('never shows the thrown error message', () => {
    render(<BadSearchParams />)

    expect(screen.getByRole('alert')).not.toHaveTextContent('Invalid search params')
  })

  it('retries through the router-supplied reset', async () => {
    const user = userEvent.setup()
    render(<Unreachable />)

    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    expect(Unreachable.args.reset).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Unreachable />)

    await expectNoA11yViolations(container)
  })
})
