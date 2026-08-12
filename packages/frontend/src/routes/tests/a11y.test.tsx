import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MAIN_CONTENT_ID } from '@/app/focus'
import { processing } from '@/features/dashboard/stories/matches'
import {
  formations,
  goals,
  match,
  phases,
  plays,
} from '@/features/report/stories/report'
import { stubApi } from '@/testing/api'
import { renderApp } from '@/testing/app'
import { expectNoA11yViolations } from '@/testing/axe'

/**
 * What a per-component axe assertion structurally cannot see: the document that
 * results once the shell, a section and their landmarks are all rendered at
 * once. Duplicate landmarks, a heading level skipped between shell and section,
 * and a tab order that starts in the wrong place only exist in composition.
 *
 * Colour is the one thing not checked here — jsdom computes none. That audit is
 * `src/styles/tests/contrast.test.ts`, over the tokens themselves.
 */

function backend() {
  return stubApi({
    '/matches': [match, processing],
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
  })
}

/** Every heading in document order, as levels. */
function headingLevels(): number[] {
  return screen
    .getAllByRole('heading')
    .map((heading) => Number(heading.tagName.slice(1)))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('composed accessibility', () => {
  it('gives the dashboard one main, one h1 and no violations', async () => {
    backend()
    const { container } = renderApp('/')

    await screen.findByRole('heading', { level: 1, name: 'WELS' })

    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

    await expectNoA11yViolations(container)
  })

  it('gives the report one h1 and an unbroken heading order', async () => {
    backend()
    const { container } = renderApp('/matches/seed01/defense')

    // The h1 is the match, so it waits for `/matches`; the section's own
    // heading is there long before that.
    await screen.findByRole('heading', { level: 1, name: /Testspiel/ })
    await screen.findByRole('heading', { level: 2, name: 'Abwehrformationen' })

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

    const levels = headingLevels()
    expect(levels[0]).toBe(1)
    for (const [index, level] of levels.slice(1).entries()) {
      expect(level - levels[index]).toBeLessThanOrEqual(1)
    }

    await expectNoA11yViolations(container)
  })

  // Two navs in one document: the app bar and the report's section switcher.
  // Unlabelled, a screen reader's landmark list would offer "navigation" twice.
  it('names both navigation landmarks in the report', async () => {
    backend()
    renderApp('/matches/seed01/overview')

    expect(
      await screen.findByRole('navigation', { name: 'Hauptnavigation' }),
    ).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Abschnitte' })).toBeVisible()
  })

  it('starts the tab order at a skip link pointing to the content', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/')

    const skip = await screen.findByRole('link', { name: 'Zum Inhalt springen' })

    await user.tab()

    expect(skip).toHaveFocus()
    expect(skip).toHaveAttribute('href', `#${MAIN_CONTENT_ID}`)
    expect(document.getElementById(MAIN_CONTENT_ID)).toBe(screen.getByRole('main'))
  })

  it('opens a match from the keyboard alone', async () => {
    const user = userEvent.setup()
    backend()
    const { router } = renderApp('/')

    const card = await screen.findByRole('link', {
      name: 'Analyse öffnen: Testspiel Nord vs Süd',
    })

    card.focus()
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/matches/seed01/overview'),
    )
  })

  it('walks the timeline with the arrow keys and seeks with Enter', async () => {
    const user = userEvent.setup()
    backend()
    renderApp('/matches/seed01/overview')

    const goalTrack = await screen.findByRole('group', { name: 'Tore' })
    const first = within(goalTrack).getAllByRole('button')[0]

    first.focus()
    await user.keyboard('{ArrowRight}')

    expect(within(goalTrack).getAllByRole('button')[1]).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(within(goalTrack).getAllByRole('button')[1]).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
