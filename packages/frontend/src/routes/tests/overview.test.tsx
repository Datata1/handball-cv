import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { stats, summary } from '@/features/overview/stories/overview'
import { formations, match, phases, plays } from '@/features/report/stories/report'
import { stubApi } from '@/testing/api'
import { renderApp } from '@/testing/app'

/**
 * The overview as the report shell mounts it: the section reads the match and
 * the scoreboard out of the cache the shell filled, and adds `/stats` on top.
 */

const VIDEO = 'Spielvideo, Originalaufnahme'

function backend(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    '/matches': [match],
    '/matches/seed01/team-phases': phases,
    '/matches/seed01/scoreboard/summary': summary,
    '/matches/seed01/stats': stats,
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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('overview section', () => {
  it('shows the score, the possession and the processing figures', async () => {
    backend()
    renderApp('/matches/seed01/overview')

    expect(await screen.findByText('5 : 3')).toBeVisible()
    expect(screen.getByText('54,3 %')).toBeVisible()
    expect(screen.getByText('60.000')).toBeVisible()
    expect(screen.getByText('71,4 %')).toBeVisible()
  })

  it('names the teams the trainer named for the possession split', async () => {
    backend()
    renderApp('/matches/seed01/overview')

    await screen.findByText('54,3 %')
    expect(screen.getAllByText('HSG Nord').length).toBeGreaterThan(0)
  })

  // The shell has already fetched both, and a section change must not pay for
  // them again.
  it('adds one request to what the shell already loaded', async () => {
    const fetchMock = backend()
    renderApp('/matches/seed01/overview')

    await screen.findByText('5 : 3')

    const requests = (path: string) =>
      fetchMock.mock.calls.filter(([input]) => String(input).includes(path))

    expect(requests('/stats')).toHaveLength(1)
    expect(requests('/scoreboard/summary')).toHaveLength(1)
  })

  it('moves the player to a goal that was clicked', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/matches/seed01/overview')

    await screen.findByLabelText(VIDEO)
    await user.click(screen.getByRole('button', { name: 'Spielzeit 06:42, Gast, 1:1' }))

    const video = screen.getByLabelText(VIDEO) as HTMLVideoElement
    await waitFor(() => expect(video.currentTime).toBe(402))
  })

  // A 404 here means the OCR never read this hall's scoreboard, which is worth
  // saying plainly rather than as a failure.
  it('reads a 404 from the scoreboard as "none was read"', async () => {
    backend({ '/matches/seed01/scoreboard/summary': undefined })
    renderApp('/matches/seed01/overview')

    expect(await screen.findByText('Keine Anzeigetafel erkannt')).toBeVisible()
    expect(screen.getByText('60.000')).toBeVisible()
  })

  // Legacy drew a second goal timeline inside the scoreboard card, scaled to a
  // hardcoded 60 minutes. Goals are a track on the shared one now.
  it('leaves the goal timeline to the shell and only lists the goals', async () => {
    backend()
    renderApp('/matches/seed01/overview')

    await screen.findByText('5 : 3')

    expect(screen.getAllByRole('group', { name: 'Tore' })).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Tore' })).toBeVisible()
  })
})
