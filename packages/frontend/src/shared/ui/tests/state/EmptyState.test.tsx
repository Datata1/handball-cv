import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/state/EmptyState.stories'

const { TitleOnly, WithAction } = composeStories(stories)

describe('EmptyState', () => {
  it('states what is missing', () => {
    render(<TitleOnly />)

    expect(screen.getByText('Noch keine Spiele')).toBeVisible()
  })

  it('renders the action slot', () => {
    render(<WithAction />)

    expect(screen.getByRole('button', { name: 'Video hochladen' })).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<WithAction />)

    await expectNoA11yViolations(container)
  })
})
