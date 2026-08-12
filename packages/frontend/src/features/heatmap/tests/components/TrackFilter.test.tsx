import { composeStories } from '@storybook/react-vite'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/TrackFilter.stories'

const { Default, TwoPicked, Loading, NoTracks } = composeStories(stories)

/** The card of one team bucket, which is a region named after the team. */
function bucket(name: string) {
  return within(screen.getByRole('heading', { name }).closest('div') as HTMLElement)
}

describe('TrackFilter', () => {
  // `available_track_ids[].team` is the raw column: `"unknown"` arrives beside
  // the normalised `"U"` of the points in the same response.
  it('groups the tracks by team, including the unassigned ones', async () => {
    render(<Default />)

    expect(await screen.findByRole('heading', { name: 'HSG Nord' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'TV Süd' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Ohne Teamzuordnung' })).toBeVisible()
  })

  // A track is not a player, so the window it was alive for is what a trainer
  // picks one by.
  it('names each track with the stretch of match it covers', async () => {
    render(<Default />)

    const track = await screen.findByRole('checkbox', { name: /Spieler 3/ })

    expect(track).toHaveAccessibleName(/00:00–36:20/)
    expect(track).toHaveAccessibleName(/41200 Frames/)
  })

  it('says that no selection means every player', async () => {
    render(<Default />)

    expect(
      await screen.findByText('Ohne Auswahl zählen alle erkannten Spieler.'),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Auswahl aufheben' })).toBeNull()
  })

  it('reports a ticked track, keeping the list in ascending order', async () => {
    const user = userEvent.setup()
    const onChange = fn()
    render(<TwoPicked onChange={onChange} />)

    await user.click(await screen.findByRole('checkbox', { name: /Spieler 5/ }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith([3, 5, 7])
  })

  it('unticks a track that was already in the selection', async () => {
    const user = userEvent.setup()
    const onChange = fn()
    render(<TwoPicked onChange={onChange} />)

    await user.click(await screen.findByRole('checkbox', { name: /Spieler 3/ }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith([7])
  })

  it('takes a whole team at once', async () => {
    const user = userEvent.setup()
    const onChange = fn()
    render(<Default onChange={onChange} />)

    await screen.findByRole('heading', { name: 'HSG Nord' })
    await user.click(bucket('HSG Nord').getByRole('button', { name: 'alle wählen' }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith([3, 5, 9])
  })

  // An empty `track_ids` is no filter to this backend, so the selection is
  // dropped rather than sent as an empty list.
  it('clears the selection back to no filter at all', async () => {
    const user = userEvent.setup()
    const onChange = fn()
    render(<TwoPicked onChange={onChange} />)

    await user.click(await screen.findByRole('button', { name: 'Auswahl aufheben' }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith(undefined)
  })

  it('states how much of the list is selected', async () => {
    render(<TwoPicked />)

    expect(await screen.findByText('2 von 8 ausgewählt')).toBeVisible()
  })

  it('announces the wait', () => {
    render(<Loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('says so when the filters left no track at all', async () => {
    render(<NoTracks />)

    expect(await screen.findByText('Keine Spieler in dieser Auswahl')).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<TwoPicked />)
    await screen.findByRole('heading', { name: 'HSG Nord' })

    await expectNoA11yViolations(container)
  })
})
