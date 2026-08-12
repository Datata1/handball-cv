import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { scenes, summary } from '@/features/defense/stories/defense'
import { match, phases } from '@/features/report/stories/report'
import { stubApi } from '@/testing/api'
import { renderApp } from '@/testing/app'

/**
 * The defense section as the report shell mounts it: the drill-in is in the
 * URL, the scenes come from the shell's own timeline query, and picking one
 * drives the single player rather than mounting a second one.
 */

const VIDEO = 'Spielvideo, Originalaufnahme'

/** An override of `undefined` drops the endpoint, so it 404s like the backend. */
function backend(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    '/matches': [match],
    '/matches/seed01/team-phases': phases,
    '/matches/seed01/formation-scenes': scenes,
    '/matches/seed01/formation-summary': summary,
    ...overrides,
  }

  for (const [path, value] of Object.entries(routes)) {
    if (value === undefined) delete routes[path]
  }

  return stubApi(routes)
}

function video(): HTMLVideoElement {
  return screen.getByLabelText(VIDEO) as HTMLVideoElement
}

/** The scene rows of the drill-in, which is a region named after the formation. */
async function sceneRows() {
  const drillIn = await screen.findByRole('region', { name: 'Szenen: 6-0' })

  return within(drillIn).findAllByRole('button')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('defense section', () => {
  it('lists both teams’ formations with plausible shares', async () => {
    backend()
    renderApp('/matches/seed01/defense')

    expect(await screen.findByText('65 % · 18.000 Frames')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'HSG Nord' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'TV Süd' })).toBeVisible()
  })

  // One row per frame per team — around 180 000 objects for a 60-minute match.
  it('never requests the unbounded per-frame endpoint', async () => {
    const fetchMock = backend()
    renderApp('/matches/seed01/defense')

    await screen.findByText('65 % · 18.000 Frames')
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        /\/formations(\?|$)/.test(String(input)),
      ),
    ).toHaveLength(0)
  })

  it('puts the drill-in in the URL, and back returns to the summary', async () => {
    const user = userEvent.setup()
    backend()
    const { router } = renderApp('/matches/seed01/defense')

    const teamA = within(await screen.findByRole('region', { name: 'HSG Nord' }))
    await user.click(teamA.getByRole('button', { name: /6-0/ }))

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        team: 'A',
        formation: '6-0',
      }),
    )
    expect(screen.getByRole('heading', { name: 'Szenen: 6-0' })).toBeVisible()

    router.history.back()

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Szenen: 6-0' })).toBeNull(),
    )
  })

  it('restores the drill-in from a cold deep link', async () => {
    backend()
    renderApp('/matches/seed01/defense?team=A&formation=6-0')

    expect(await sceneRows()).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Szenen: 6-0' })).toBeVisible()
    expect(screen.getByText('2 Szenen in dieser Formation.')).toBeVisible()
  })

  it('seeks the shared player to the scene that was picked', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/matches/seed01/defense?team=A&formation=6-0')

    await user.click((await sceneRows())[1])

    await waitFor(() => expect(video().currentTime).toBe(800))
    expect((await sceneRows())[1]).toHaveAttribute('aria-pressed', 'true')
  })

  // The clip is what the seek is for: playback stays inside the scene, so a
  // scrub to the end of the match lands on the end of the scene instead.
  it('clips the player to the scene', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/matches/seed01/defense?team=A&formation=6-0')

    await user.click((await sceneRows())[1])
    await waitFor(() => expect(video().currentTime).toBe(800))

    screen.getByRole('slider', { name: 'Abspielposition' }).focus()
    await user.keyboard('{End}')

    await waitFor(() => expect(video().currentTime).toBe(884))
  })

  // The section does not render the timeline; the shell above it does.
  it('marks the scene on the shared timeline', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/matches/seed01/defense?team=A&formation=6-0')

    await user.click((await sceneRows())[0])

    expect(await screen.findByText('Ausgewählt: 6-0, HSG Nord')).toBeInTheDocument()
  })

  // Legacy told the trainer to run `wels-score <id>` themselves.
  it('says the analysis has not run, without naming a command', async () => {
    backend({ '/matches/seed01/formation-summary': undefined })
    renderApp('/matches/seed01/defense')

    expect(await screen.findByText('Noch keine Formationen erkannt')).toBeVisible()
    expect(screen.queryByText(/wels-score/)).toBeNull()
  })
})
