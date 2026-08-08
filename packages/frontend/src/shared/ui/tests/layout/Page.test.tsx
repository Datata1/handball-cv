import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/layout/Page.stories'

const { Default } = composeStories(stories)

describe('Page', () => {
  it('renders one heading per section below the page title', () => {
    render(<Default />)

    expect(screen.getByRole('heading', { level: 1, name: 'Spiele' })).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)

    await expectNoA11yViolations(container)
  })
})
