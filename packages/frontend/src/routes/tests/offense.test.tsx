import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { plays, summary } from '@/features/offense/stories/offense'
import { match, phases } from '@/features/report/stories/report'
import { stubApi } from '@/testing/api'
import { renderApp } from '@/testing/app'

/**
 * The offense section as the report shell mounts it: the drill-in is in the
 * URL, the scenes come from the shell's own timeline query, and picking one
 * drives the single player rather than mounting a second one.
 */

const VIDEO = 'Spielvideo, Originalaufnahme'

/** An override of `undefined` drops the endpoint, so it 404s like the backend. */
function backend(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    '/matches': [match],
    '/matches/seed01/team-phases': phases,
    '/matches/seed01/plays': plays,
    '/matches/seed01/play-summary': summary,
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

/**
 * The section itself. Queries are scoped to it because the shell's timeline
 * names its own items after the same play types.
 */
async function section() {
  return within(await screen.findByRole('region', { name: 'Offensive Spielzüge' }))
}

/** The scene rows of the drill-in, which is a region named after the play type. */
async function sceneRows() {
  const drillIn = await screen.findByRole('region', { name: 'Szenen: Kreuzen' })

  return within(drillIn).findAllByRole('button')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('offense section', () => {
  it('lists the play types the detector reported', async () => {
    backend()
    renderApp('/matches/seed01/offense')

    expect(await screen.findByText('20 Szenen')).toBeVisible()
    expect(screen.getByText('HSG Nord: 14×')).toBeVisible()
  })

  // The legacy tab iterated a four-entry frontend dictionary, so a type outside
  // it rendered nothing at all.
  it('renders a play type no dictionary knows', async () => {
    backend()
    renderApp('/matches/seed01/offense')

    expect(
      await (await section()).findByRole('button', { name: /rueckraumdurchbruch/ }),
    ).toBeVisible()
  })

  it('puts the drill-in in the URL, and back returns to the summary', async () => {
    const user = userEvent.setup()
    backend()
    const { router } = renderApp('/matches/seed01/offense')

    await user.click(await (await section()).findByRole('button', { name: /^Kreuzen/ }))

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ playType: 'kreuzen' }),
    )
    expect(screen.getByRole('heading', { name: 'Szenen: Kreuzen' })).toBeVisible()

    router.history.back()

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Szenen: Kreuzen' })).toBeNull(),
    )
  })

  it('restores the drill-in from a cold deep link', async () => {
    backend()
    renderApp('/matches/seed01/offense?playType=kreuzen')

    expect(await sceneRows()).toHaveLength(3)
    expect(screen.getByText('3 Szenen dieses Spielzugs.')).toBeVisible()
  })

  it('seeks the shared player to the scene that was picked', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/matches/seed01/offense?playType=kreuzen')

    await user.click((await sceneRows())[1])

    await waitFor(() => expect(video().currentTime).toBe(388))
    expect((await sceneRows())[1]).toHaveAttribute('aria-pressed', 'true')
  })

  // The clip is what the seek is for: playback stays inside the scene, so a
  // scrub to the end of the match lands on the end of the scene instead.
  it('clips the player to the scene', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/matches/seed01/offense?playType=kreuzen')

    await user.click((await sceneRows())[1])
    await waitFor(() => expect(video().currentTime).toBe(388))

    screen.getByRole('slider', { name: 'Abspielposition' }).focus()
    await user.keyboard('{End}')

    await waitFor(() => expect(video().currentTime).toBe(399))
  })

  // The section does not render the timeline; the shell above it does.
  it('marks the scene on the shared timeline', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/matches/seed01/offense?playType=kreuzen')

    await user.click((await sceneRows())[0])

    expect(await screen.findByText('Ausgewählt: Kreuzen, HSG Nord')).toBeInTheDocument()
  })

  it('draws the picked scene’s trajectories on the shared court', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/matches/seed01/offense?playType=kreuzen')

    await user.click((await sceneRows())[0])

    expect(
      await screen.findByRole('img', { name: 'Laufwege: Kreuzen, HSG Nord' }),
    ).toBeInTheDocument()
  })

  // `details` is free-form server-side, so an event the court cannot read keeps
  // its row and loses only the picture.
  it('keeps the section standing when a scene has no drawable trajectories', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/matches/seed01/offense?playType=kreuzen')

    await user.click((await sceneRows())[2])

    expect(
      await screen.findByText('Für diese Szene sind keine Laufwege gespeichert.'),
    ).toBeVisible()
    expect(screen.getByText('3 Szenen dieses Spielzugs.')).toBeVisible()
  })

  // The label loop stays deferred until the GCN + LSTM work lands.
  it('ships no way to label a detection', async () => {
    const user = userEvent.setup()
    const fetchMock = backend()
    renderApp('/matches/seed01/offense?playType=kreuzen')

    await user.click((await sceneRows())[1])

    expect(screen.queryByRole('button', { name: 'Richtig erkannt' })).toBeNull()
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).includes('/label')),
    ).toHaveLength(0)
  })

  it('says the analysis has not run, without naming a command', async () => {
    backend({ '/matches/seed01/play-summary': [] })
    renderApp('/matches/seed01/offense')

    expect(await screen.findByText('Noch keine Spielzüge erkannt')).toBeVisible()
    expect(screen.queryByText(/wels-plays/)).toBeNull()
  })
})
