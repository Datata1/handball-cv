import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/RouteNotFound.stories'

const { Default } = composeStories(stories)

describe('RouteNotFound', () => {
  it('says the address belongs to no view', async () => {
    render(<Default />)

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Seite nicht gefunden',
    )
  })

  it('offers a way back to the overview', async () => {
    render(<Default />)

    expect(await screen.findByRole('link', { name: 'Zur Übersicht' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByRole('link')

    await expectNoA11yViolations(container)
  })
})
