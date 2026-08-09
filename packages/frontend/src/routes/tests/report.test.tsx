import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  formations,
  goals,
  match,
  phases,
  plays,
  processingMatch,
} from '@/features/report/stories/report'
import { stubApi } from '@/testing/api'
import { renderApp } from '@/testing/app'

/**
 * The report shell as the route tree assembles it. The one behaviour worth the
 * whole structure — the player surviving a section change — can only be
 * asserted here, against the real layout route.
 */

const VIDEO = 'Spielvideo, Originalaufnahme'

/** The six endpoints the shell reads. An override of `undefined` drops one. */
function backend(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    '/matches': [match],
    '/matches/seed01/team-phases': phases,
    '/matches/seed01/scoreboard/summary': {
      match_id: 'seed01',
      final_score_home: 1,
      final_score_away: 1,
      final_game_time: '40:00',
      goals,
    },
    '/matches/seed01/plays': plays,
    '/matches/seed01/formation-scenes': formations,
    '/videos/seed01/output': {
      match_id: 'seed01',
      video_path: '/srv/wels/data/output/videos/seed01_annotated.mp4',
      status: 'ready',
    },
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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('report shell', () => {
  it('names the match and its teams above the sections', async () => {
    backend()
    renderApp('/matches/seed01/overview')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Testspiel Nord vs Süd',
    )
    expect(screen.getByText('HSG Nord')).toBeVisible()
  })

  // The whole point of the layout route: a trainer switching from Abwehr to
  // Angriff mid-move does not restart the video.
  it('keeps the same video element across a section change', async () => {
    const user = userEvent.setup()
    backend()
    const { router } = renderApp('/matches/seed01/overview')

    await screen.findByLabelText(VIDEO)
    const before = video()

    await user.click(screen.getByRole('link', { name: 'Abwehr' }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/matches/seed01/defense'),
    )

    expect(video()).toBe(before)
  })

  it('lands a deep link on the moment it names', async () => {
    backend()
    renderApp('/matches/seed01/overview?at=754.2')

    await screen.findByLabelText(VIDEO)

    await waitFor(() => expect(video().currentTime).toBe(754.2))
  })

  it('builds the timeline from every source the match has', async () => {
    backend()
    renderApp('/matches/seed01/overview')

    expect(await screen.findByRole('group', { name: 'Tore' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Ballbesitz' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Spielzüge' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Formationen' })).toBeVisible()
  })

  it('names a play the backend labelled and no dictionary knows', async () => {
    backend()
    renderApp('/matches/seed01/overview')

    expect(
      await screen.findByRole('button', {
        name: 'rueckraumdurchbruch, TV Süd, 06:28 bis 06:39',
      }),
    ).toBeVisible()
  })

  it('leaves out a track whose endpoint never answered', async () => {
    backend({ '/matches/seed01/formation-scenes': undefined })
    renderApp('/matches/seed01/overview')

    await screen.findByRole('group', { name: 'Ballbesitz' })
    expect(screen.queryByRole('group', { name: 'Formationen' })).not.toBeInTheDocument()
  })

  it('offers the annotated render when one exists', async () => {
    backend()
    renderApp('/matches/seed01/overview')

    expect(await screen.findByRole('button', { name: 'Annotiert' })).toBeEnabled()
  })

  it('offers no source toggle for a match that was never annotated', async () => {
    backend({
      '/videos/seed01/output': {
        match_id: 'seed01',
        video_path: null,
        status: 'done',
      },
    })
    renderApp('/matches/seed01/overview')

    await screen.findByLabelText(VIDEO)
    expect(screen.queryByRole('button', { name: 'Annotiert' })).not.toBeInTheDocument()
  })

  it('shows the sections even while the match itself is still ingesting', async () => {
    backend({ '/matches': [processingMatch] })
    renderApp('/matches/seed01/overview')

    expect(await screen.findByText('Das Spiel wird noch verarbeitet')).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Übersicht' })).toBeVisible()
  })

  it('is not found only once no ingestion could be hiding it', async () => {
    backend({ '/matches': [] })
    renderApp('/matches/seed01/overview')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Seite nicht gefunden',
    )
  })
})
