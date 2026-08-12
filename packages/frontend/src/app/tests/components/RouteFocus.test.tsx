import { composeStories } from '@storybook/react-vite'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { done } from '@/features/dashboard/stories/matches'
import { match, phases } from '@/features/report/stories/report'
import { stubApi } from '@/testing/api'
import { renderApp } from '@/testing/app'
import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/RouteFocus.stories'

const { Default } = composeStories(stories)

/**
 * Focus after a navigation, against the real route tree — the only place it
 * exists. A story can prove the wrapper renders; it cannot prove that clicking
 * a link moved anything.
 */

function backend() {
  return stubApi({
    '/matches': [done, match],
    '/matches/seed01/team-phases': phases,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RouteFocus', () => {
  it('renders its children and one empty live region', async () => {
    const { container } = render(<Default />)

    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('')

    await expectNoA11yViolations(container)
  })

  it('leaves focus alone on the view a URL opened directly', async () => {
    backend()
    renderApp('/')

    await screen.findByRole('heading', { level: 1, name: 'WELS' })

    expect(document.body).toHaveFocus()
  })

  it('moves focus into the content on a route change', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/')

    await user.click(await screen.findByRole('link', { name: 'Upload' }))

    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus())
  })

  it('names the view it landed on', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/')

    await user.click(await screen.findByRole('link', { name: 'Upload' }))

    // Whichever live region carries it: the upload view mounts one of its own,
    // and both are nameless by design.
    await waitFor(() =>
      expect(
        screen.getAllByRole('status').map((region) => region.textContent),
      ).toContain('Video hochladen'),
    )
  })

  // The player is above the section content and stays mounted across the
  // change; sending focus back to <main> would put it above the video again.
  it('lands in the section rather than the shell inside a report', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/matches/seed01/overview')

    await user.click(await screen.findByRole('link', { name: 'Abwehr' }))

    const heading = await screen.findByRole('heading', { name: 'Abwehrformationen' })

    await waitFor(() => {
      const focused = document.activeElement

      expect(focused).not.toBe(screen.getByRole('main'))
      expect(focused?.contains(heading)).toBe(true)
    })
  })
})
