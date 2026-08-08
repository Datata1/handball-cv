import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { done, unnamed } from '@/features/dashboard/stories/matches'
import summary from '@/shared/api/tests/fixtures/scoreboard-summary.json'
import { stubApi } from '@/testing/api'
import { renderApp } from '@/testing/app'

/**
 * The dashboard wired to the real route tree and a stubbed backend: what the
 * cards say, and what the URL says about them. The states each component can be
 * in are covered by its own stories.
 */
describe('dashboard route', () => {
  beforeEach(() => {
    stubApi({
      '/matches': [unnamed, done],
      '/matches/seed01/scoreboard/summary': summary,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists what the backend returns, newest first', async () => {
    renderApp('/')

    await screen.findByRole('link', { name: 'Testspiel Nord vs Süd' })
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Testspiel Nord vs Süd', 'aufzeichnung-2026-05-02.mp4'])
  })

  it('shows the final score from the summary endpoint, not the reading log', async () => {
    renderApp('/')

    expect(await screen.findByText('2')).toBeVisible()
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([input]) => String(input).endsWith('/scoreboard')),
    ).toBe(false)
  })

  it('treats a 404 from the score endpoint as "no score", not as an error', async () => {
    renderApp('/')

    await screen.findByRole('link', { name: 'aufzeichnung-2026-05-02.mp4' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('filters the list and puts the search in the URL', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/')

    await user.type(await screen.findByRole('searchbox'), 'Nord')

    await waitFor(() =>
      expect(router.state.location.search).toEqual({ q: 'Nord', sort: 'recent' }),
    )
    expect(
      screen.queryByRole('link', { name: 'aufzeichnung-2026-05-02.mp4' }),
    ).not.toBeInTheDocument()
  })

  it('restores a search a link arrived with', async () => {
    renderApp('/?q=aufzeichnung')

    expect(
      await screen.findByRole('link', { name: 'aufzeichnung-2026-05-02.mp4' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('link', { name: 'Testspiel Nord vs Süd' }),
    ).not.toBeInTheDocument()
  })

  it('reorders on sort, and says so in the URL', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/')

    await user.selectOptions(await screen.findByRole('combobox'), 'name')

    await waitFor(() =>
      expect(
        screen
          .getAllByRole('heading', { level: 3 })
          .map((heading) => heading.textContent),
      ).toEqual(['aufzeichnung-2026-05-02.mp4', 'Testspiel Nord vs Süd']),
    )
    expect(router.state.location.searchStr).toBe('?sort=name')
  })

  it('restores the order a link arrived with', async () => {
    renderApp('/?sort=name')

    await screen.findByRole('link', { name: 'Testspiel Nord vs Süd' })
    expect(screen.getByRole('combobox')).toHaveValue('name')
  })
})
