import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/test/axe'

import * as stories from './index.stories'

const { Default } = composeStories(stories)

describe('Home', () => {
  it('renders the product heading', () => {
    render(<Default />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WELS')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)

    await expectNoA11yViolations(container)
  })
})
