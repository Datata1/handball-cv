import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/layout/AppHeader.stories'

const { Default, WithConnectionIndicator } = composeStories(stories)

// findBy*, not getBy*: the story's router resolves its first match in an
// effect, so nothing is in the DOM on the render pass itself.
describe('AppHeader', () => {
  it('is a named navigation landmark', async () => {
    render(<Default />)

    expect(
      await screen.findByRole('navigation', { name: 'Hauptnavigation' }),
    ).toBeVisible()
  })

  it('links the mark back to the overview', async () => {
    render(<Default />)

    expect(
      await screen.findByRole('link', { name: 'WELS — zur Übersicht' }),
    ).toHaveAttribute('href', '/')
  })

  it('renders whatever the nav slot is given', async () => {
    render(<WithConnectionIndicator />)

    expect(await screen.findByRole('navigation')).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByRole('navigation')

    await expectNoA11yViolations(container)
  })
})
