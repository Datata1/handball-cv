import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { match } from '@/features/report/stories/report'
import { stubApi } from '@/testing/api'
import { renderApp } from '@/testing/app'

/**
 * The route tree as a whole: what a URL resolves to, what survives a
 * navigation, and what happens when neither is well formed. Component-level
 * behaviour lives with the components.
 */

// The report shell loads the match list, so every match URL below is a real
// match. What it renders around the sections is `report.test.tsx`.
beforeEach(() => {
  stubApi({ '/matches': [{ ...match, match_id: 'abc123' }] })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('route tree', () => {
  it('renders the dashboard at the root', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('WELS')
  })

  it('sends a bare match URL to the overview', async () => {
    const { router } = renderApp('/matches/abc123')

    await screen.findByRole('heading', { level: 2, name: 'Übersicht' })
    expect(router.state.location.pathname).toBe('/matches/abc123/overview')
  })

  it('restores every heatmap filter from a cold deep link', async () => {
    const { router } = renderApp(
      '/matches/abc123/heatmap?mode=tiles&perspective=offense&from=120&to=300',
    )

    await screen.findByRole('heading', { level: 2, name: 'Heatmap' })
    expect(router.state.location.search).toEqual({
      mode: 'tiles',
      perspective: 'offense',
      from: 120,
      to: 300,
    })
  })

  it('keeps the match and the playhead when switching section', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/matches/abc123/overview?at=754.2')

    await user.click(await screen.findByRole('link', { name: 'Abwehr' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/matches/abc123/defense'),
    )
    expect(router.state.location.search).toEqual({ at: 754.2 })
  })

  it('leaves a section filter behind when the section changes', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/matches/abc123/defense?formation=6-0')

    await user.click(await screen.findByRole('link', { name: 'Angriff' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/matches/abc123/offense'),
    )
    expect(router.state.location.search).not.toHaveProperty('formation')
  })

  it('keeps defaulted heatmap params out of the URL', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/matches/abc123/overview')

    await user.click(await screen.findByRole('link', { name: 'Heatmap' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/matches/abc123/heatmap'),
    )
    expect(router.state.location.searchStr).toBe('')
  })

  it('renders the not-found boundary for an address no route owns', async () => {
    renderApp('/spielbericht/abc123')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Seite nicht gefunden',
    )
  })

  it('renders the error boundary when a search param cannot be validated', async () => {
    renderApp('/matches/abc123/heatmap?from=120')

    expect(await screen.findByRole('alert')).toBeVisible()
  })
})
