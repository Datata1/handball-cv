import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/state/LoadingState.stories'

const { Default, List } = composeStories(stories)

describe('LoadingState', () => {
  it('announces itself as busy', () => {
    render(<Default />)

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveTextContent('Wird geladen…')
  })

  it('lets the caller say what is loading', () => {
    render(<List />)

    expect(screen.getByRole('status')).toHaveTextContent('Spiele werden geladen…')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)

    await expectNoA11yViolations(container)
  })
})
