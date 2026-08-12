import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { statsWithTracks } from '@/features/players/stories/players'
import { match, phases } from '@/features/report/stories/report'
import { stubApi } from '@/testing/api'
import { renderApp } from '@/testing/app'

/**
 * The players section as the report shell mounts it: `/stats` is the only thing
 * it adds, and the table's order and filter are in the URL rather than in React
 * state, so a trainer can send someone the table as they are reading it.
 */

function backend(overrides: Record<string, unknown> = {}) {
  return stubApi({
    '/matches': [match],
    '/matches/seed01/team-phases': phases,
    '/matches/seed01/stats': statsWithTracks,
    ...overrides,
  })
}

const rowIds = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('players section', () => {
  it('lists the tracks the endpoint returned, longest-lived first', async () => {
    backend()
    renderApp('/matches/seed01/players')

    expect(await screen.findByText('#3')).toBeVisible()
    expect(rowIds().slice(0, 3)).toEqual(['#3', '#7', '#12'])
  })

  it('names the teams the trainer named', async () => {
    backend()
    renderApp('/matches/seed01/players')

    await screen.findByText('#3')
    const table = within(screen.getByRole('table'))

    expect(table.getAllByText('HSG Nord')).toHaveLength(11)
    expect(table.getAllByText('Ohne Teamzuordnung')).toHaveLength(3)
  })

  it('reorders on a column header and puts the order in the URL', async () => {
    const user = userEvent.setup()
    backend()
    const { router } = renderApp('/matches/seed01/players')

    await user.click(await screen.findByRole('button', { name: 'Track-ID' }))

    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        sort: 'track',
        dir: 'ascending',
      }),
    )
    expect(rowIds().slice(0, 3)).toEqual(['#2', '#3', '#4'])
  })

  it('restores the order and the filter from a cold deep link', async () => {
    backend()
    renderApp('/matches/seed01/players?team=B&sort=distance&dir=ascending')

    await screen.findByText('#44')
    expect(rowIds().slice(0, 2)).toEqual(['#44', '#39'])
    expect(screen.getByRole('combobox', { name: 'Mannschaft' })).toHaveValue('B')
  })

  // "All teams" is the absence of a filter, so it leaves the URL rather than
  // sitting in it as a value.
  it('drops the team from the URL when the filter is cleared', async () => {
    const user = userEvent.setup()
    backend()
    const { router } = renderApp('/matches/seed01/players?team=B')

    await screen.findByText('#7')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Mannschaft' }),
      'Alle Mannschaften',
    )

    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('team'))
    expect(screen.getByText('25 Tracks')).toBeVisible()
  })

  // The overview has already paid for `/stats`; arriving here must not pay again.
  it('reads the stats the overview already fetched', async () => {
    const user = userEvent.setup()
    const fetchMock = backend()
    renderApp('/matches/seed01/overview')

    await screen.findByText('60.000')
    await user.click(screen.getByRole('link', { name: 'Spieler' }))

    await screen.findByText('#3')
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).includes('/stats')),
    ).toHaveLength(1)
  })

  it('says so when the match has no tracks stored', async () => {
    backend({ '/matches/seed01/stats': { ...statsWithTracks, player_stats: [] } })
    renderApp('/matches/seed01/players')

    expect(await screen.findByText('Keine Tracks gespeichert')).toBeVisible()
  })
})
