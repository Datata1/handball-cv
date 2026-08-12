import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { heatmapPoints, stats } from '@/features/heatmap/stories/heatmap'
import { match, phases } from '@/features/report/stories/report'
import { stubApi } from '@/testing/api'
import { renderApp } from '@/testing/app'

/**
 * The heatmap section as the report shell mounts it: every control is a search
 * param, the tiles come from `/stats` and the point cloud from
 * `/heatmap-points`, and the shared timeline is the phase picker.
 */

function backend(overrides: Record<string, unknown> = {}) {
  return stubApi({
    '/matches': [match],
    '/matches/seed01/team-phases': phases,
    '/matches/seed01/stats': stats,
    '/matches/seed01/heatmap-points': heatmapPoints,
    ...overrides,
  })
}

type FetchMock = ReturnType<typeof stubApi>

/** Every request the app made to one endpoint, as URLs. */
function requests(fetchMock: FetchMock, path: string): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes(path))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('heatmap section', () => {
  it('shows what the filters selected, and offers the tracks to narrow it', async () => {
    backend()
    renderApp('/matches/seed01/heatmap')

    expect(
      await screen.findByText('1.240 Positionsmessungen in dieser Auswahl'),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Spieler filtern' })).toBeVisible()
  })

  // The drawing is a canvas over the shared court, so what the section can be
  // held to is that the court is there and says what it is showing.
  it('draws the selected points on the shared court', async () => {
    backend()
    renderApp('/matches/seed01/heatmap')

    expect(
      await screen.findByRole('img', {
        name: 'Verteilung von 1.240 gemessenen Spielerpositionen auf dem Spielfeld',
      }),
    ).toBeInTheDocument()
  })

  it('has nothing to draw for a selection with no points in it', async () => {
    backend({
      '/matches/seed01/heatmap-points': {
        available_track_ids: [],
        heatmap_points: [],
      },
    })
    renderApp('/matches/seed01/heatmap')

    expect(await screen.findByText('Keine Positionen in dieser Auswahl')).toBeVisible()
    expect(screen.queryByRole('img', { name: /Verteilung von/ })).toBeNull()
  })

  it('restores every filter from a cold deep link', async () => {
    const fetchMock = backend()
    renderApp(
      '/matches/seed01/heatmap?perspective=offense&phase=2&tracks=%5B3%2C7%5D&from=390&to=405',
    )

    await screen.findByText('1.240 Positionsmessungen in dieser Auswahl')

    expect(screen.getByRole('button', { name: 'Angriff' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('TV Süd Angriff (06:20–06:50)')).toBeVisible()
    expect(screen.getByRole('checkbox', { name: /Spieler 3/ })).toBeChecked()

    const [url] = requests(fetchMock, '/heatmap-points')
    expect(url).toContain('phase_id=2')
    expect(url).toContain('perspective=offense')
    expect(url).toContain('window_start_s=390')
    expect(url).toContain('window_end_s=405')
  })

  // A malformed `track_ids` is an uncaught `ValueError` server-side — a 500,
  // not a 422 — so the ids are built from integers the client already holds.
  it('sends the track filter as a comma-separated list of integers', async () => {
    const fetchMock = backend()
    renderApp('/matches/seed01/heatmap?tracks=%5B3%2C7%5D')

    await screen.findByText('1.240 Positionsmessungen in dieser Auswahl')

    expect(requests(fetchMock, '/heatmap-points')[0]).toContain('track_ids=3%2C7')
  })

  // `track_ids` narrows the points only. Keying the picker off the filtered
  // response would leave a trainer unable to widen their own filter.
  it('keeps the whole track list while the points are filtered', async () => {
    backend()
    renderApp('/matches/seed01/heatmap?tracks=%5B3%5D')

    expect(await screen.findByText('1 von 8 ausgewählt')).toBeVisible()
    expect(screen.getAllByRole('checkbox')).toHaveLength(8)
  })

  it('puts a ticked track in the URL and asks the backend again', async () => {
    const user = userEvent.setup()
    const fetchMock = backend()
    const { router } = renderApp('/matches/seed01/heatmap')

    await user.click(await screen.findByRole('checkbox', { name: /Spieler 7/ }))

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ tracks: [7] }),
    )
    await waitFor(() => expect(requests(fetchMock, '/heatmap-points')).toHaveLength(2))
  })

  // Both views are already loaded once the mode has been switched, so switching
  // back is a render rather than a request.
  it('switches between the two views without refetching either', async () => {
    const user = userEvent.setup()
    const fetchMock = backend()
    renderApp('/matches/seed01/heatmap')

    await screen.findByText('1.240 Positionsmessungen in dieser Auswahl')
    await user.click(screen.getByRole('button', { name: 'Kacheln' }))

    expect(await screen.findByText('100 % der stärksten Zone')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Dichte' }))
    await screen.findByText('1.240 Positionsmessungen in dieser Auswahl')

    expect(requests(fetchMock, '/heatmap-points')).toHaveLength(1)
    expect(requests(fetchMock, '/stats')).toHaveLength(1)
  })

  // The tile view is `/stats`, which summarises the whole match and takes no
  // parameters at all.
  it('does not offer the point-cloud filters in the tile view', async () => {
    backend()
    renderApp('/matches/seed01/heatmap?mode=tiles&perspective=offense')

    expect(await screen.findByText('100 % der stärksten Zone')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Spieler filtern' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Zeitfenster' })).toBeNull()
  })

  // Legacy carried a second phase control; the shell's timeline is the picker.
  it('takes the phase from the shared timeline and puts it in the URL', async () => {
    const user = userEvent.setup()
    backend()
    const { router } = renderApp('/matches/seed01/heatmap')

    await screen.findByText('1.240 Positionsmessungen in dieser Auswahl')
    await user.click(screen.getByRole('button', { name: /Angriff: HSG Nord, 02:00/ }))

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ phase: 1 }),
    )
    expect(screen.getByText('HSG Nord Angriff (02:00–02:21)')).toBeVisible()
  })

  it('highlights the phase a deep link names on the shared timeline', async () => {
    backend()
    renderApp('/matches/seed01/heatmap?phase=1')

    expect(await screen.findByText('Ausgewählt: Angriff: HSG Nord')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Angriff: HSG Nord, 02:00/ }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('drops the phase filter again, and the video with it', async () => {
    const user = userEvent.setup()
    backend()
    const { router } = renderApp('/matches/seed01/heatmap?phase=1')

    await user.click(await screen.findByRole('button', { name: 'Phase aufheben' }))

    await waitFor(() =>
      expect(router.state.location.search).not.toMatchObject({ phase: 1 }),
    )
    expect(screen.getByText('Ganzes Spiel')).toBeVisible()
  })

  // A push that fires from the store would immediately undo the back button.
  it('steps back out of a filter without being pushed forward again', async () => {
    const user = userEvent.setup()
    backend()
    const { router } = renderApp('/matches/seed01/heatmap')

    await screen.findByText('1.240 Positionsmessungen in dieser Auswahl')
    await user.click(screen.getByRole('button', { name: /Angriff: HSG Nord, 02:00/ }))
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ phase: 1 }),
    )

    router.history.back()

    await waitFor(() => expect(screen.getByText('Ganzes Spiel')).toBeVisible())
    expect(router.state.location.search).not.toMatchObject({ phase: 1 })
  })

  // One request feeds both the picker and the cloud. A body the schema rejects
  // is the failure that is never retried, so it surfaces at once.
  it('reports a failed point request once, not in every control', async () => {
    backend({ '/matches/seed01/heatmap-points': { available_track_ids: 'keine' } })
    renderApp('/matches/seed01/heatmap')

    expect(await screen.findAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'Spieler filtern' })).toBeNull()
  })
})
