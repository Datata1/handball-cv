import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/layout/AppHeader.stories'

const { Default, WithConnectionIndicator, WithSkipLink } = composeStories(stories)

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

  it('offers no skip link where there is nothing to skip to', async () => {
    render(<Default />)
    await screen.findByRole('navigation')

    expect(
      screen.queryByRole('link', { name: 'Zum Inhalt springen' }),
    ).not.toBeInTheDocument()
  })

  // Ahead of the mark and the nav, or it is not a skip link — it is a link the
  // user reaches after tabbing through everything it was meant to skip.
  it('puts the skip link first in the tab order', async () => {
    const user = userEvent.setup()
    render(<WithSkipLink />)
    await screen.findByRole('navigation')

    await user.tab()

    expect(screen.getByRole('link', { name: 'Zum Inhalt springen' })).toHaveFocus()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByRole('navigation')

    await expectNoA11yViolations(container)
  })
})
