import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/layout/PageHeader.stories'

const { TitleOnly, WithActions } = composeStories(stories)

describe('PageHeader', () => {
  it('renders the title as the page h1', () => {
    render(<TitleOnly />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'TSV Hannover-Burgdorf – SC Magdeburg',
    )
  })

  it('renders the actions slot beside the title', () => {
    render(<WithActions />)

    expect(screen.getByRole('button', { name: 'Umbenennen' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<WithActions />)

    await expectNoA11yViolations(container)
  })
})
