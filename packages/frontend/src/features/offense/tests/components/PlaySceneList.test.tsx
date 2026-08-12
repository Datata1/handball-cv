import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/PlaySceneList.stories'

const { Default, Selected, NoScenes, Frozen, Loading, Failed } = composeStories(stories)

describe('PlaySceneList', () => {
  it('lists every run of the play type with its window and team', async () => {
    render(<Default />)

    expect(await screen.findByText('01:58 – 02:11')).toBeVisible()
    expect(screen.getByText('3 Szenen dieses Spielzugs.')).toBeVisible()
    expect(screen.getAllByText('HSG Nord')).toHaveLength(2)
  })

  it('marks the attacks the scoreboard settled', async () => {
    render(<Default />)

    expect(await screen.findByText('Tor')).toBeVisible()
    expect(screen.getByText('Kein Tor')).toBeVisible()
  })

  // A null outcome is "no attack was linked" and "this database predates attack
  // sequences" at once. Neither of them is "kein Tor".
  it('says an unlinked attack is unknown, not a miss', async () => {
    render(<Default />)

    expect(await screen.findByText('Ausgang unbekannt')).toBeVisible()
  })

  /** The label loop is deferred, so a stored verdict is shown and never set. */
  it('shows a coach verdict without offering to change it', async () => {
    render(<Default />)

    expect(await screen.findByText('Trainerbewertung: Richtig erkannt')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Richtig erkannt' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Falsch erkannt' })).toBeNull()
  })

  it('reports the scene that was picked', async () => {
    const user = userEvent.setup()
    const onSelect = fn()
    render(<Default onSelect={onSelect} />)

    await user.click((await screen.findAllByRole('button'))[0])

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect.mock.calls[0][0]).toMatchObject({ event_id: 11 })
  })

  it('releases the clip when the selected scene is picked again', async () => {
    const user = userEvent.setup()
    const onSelect = fn()
    render(<Selected onSelect={onSelect} />)

    await user.click(await screen.findByRole('button', { pressed: true }))

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('says the play type has no stored scenes', async () => {
    render(<NoScenes />)

    expect(await screen.findByText('Keine Szenen zu diesem Spielzug')).toBeVisible()
  })

  it('reads an empty list during ingestion as "not yet"', async () => {
    render(<Frozen />)

    expect(await screen.findByText('Noch nicht verfügbar')).toBeVisible()
  })

  it('announces the wait', () => {
    render(<Loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('offers a retry when the request failed', async () => {
    const user = userEvent.setup()
    const onRetry = fn()
    render(<Failed onRetry={onRetry} />)

    await user.click(await screen.findByRole('button', { name: 'Erneut versuchen' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByText('01:58 – 02:11')

    await expectNoA11yViolations(container)
  })
})
