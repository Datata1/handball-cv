import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/state/ErrorState.stories'

const { Unreachable, NotFound, FrozenByProcessing, ContractChanged, WithoutRetry } =
  composeStories(stories)

describe('ErrorState', () => {
  it.each([
    ['a dead connection', Unreachable, 'Der Server ist nicht erreichbar.'],
    ['a 404', NotFound, 'Nicht gefunden.'],
    ['a schema mismatch', ContractChanged, 'Die Antwort des Servers war unerwartet'],
  ])('renders German copy for %s', (_case, Story, copy) => {
    render(<Story />)

    expect(screen.getByRole('alert')).toHaveTextContent(copy)
  })

  it('reads a 404 as "not yet" while a match is being ingested', () => {
    render(<FrozenByProcessing />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Noch nicht verfügbar')
    expect(alert).not.toHaveTextContent('Nicht gefunden.')
  })

  it('calls onRetry from the retry button', async () => {
    const user = userEvent.setup()
    render(<Unreachable />)

    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    expect(Unreachable.args.onRetry).toHaveBeenCalledOnce()
  })

  it('omits the button when there is nothing to retry', () => {
    render(<WithoutRetry />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Unreachable />)

    await expectNoA11yViolations(container)
  })
})
