import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/PlayTypeList.stories'

const {
  Default,
  NovelPlayType,
  NothingRated,
  DrilledIn,
  NoPlays,
  Frozen,
  Loading,
  Failed,
} = composeStories(stories)

describe('PlayTypeList', () => {
  it('lists the play types the detector found, most-detected first', async () => {
    render(<Default />)

    // Each row opens with its own label, so the first words are the order.
    const rows = (await screen.findAllByRole('button')).map(
      (button) => button.textContent ?? '',
    )
    expect(rows).toHaveLength(4)
    expect(rows[0].startsWith('Kreuzen')).toBe(true)
    expect(rows[1].startsWith('Tempogegenstoß')).toBe(true)
    expect(rows[2].startsWith('Einläufer')).toBe(true)
    expect(rows[3].startsWith('rueckraumdurchbruch')).toBe(true)
  })

  it('counts a type over both teams and names who ran it', async () => {
    render(<Default />)

    expect(await screen.findByText('20 Szenen')).toBeVisible()
    expect(screen.getByText('HSG Nord: 14×')).toBeVisible()
    expect(screen.getByText('TV Süd: 6×')).toBeVisible()
  })

  // The GCN + LSTM work changes the label set. A play type the frontend has
  // never heard of has to render as itself.
  it('renders a play type no dictionary knows under its own name', async () => {
    render(<NovelPlayType />)

    expect(
      await screen.findByRole('button', { name: /rueckraumdurchbruch/ }),
    ).toBeVisible()
  })

  it('rates a type over both teams’ attacks', async () => {
    render(<Default />)

    expect(await screen.findByText('50 % mit Tor (6 von 12 Angriffen)')).toBeVisible()
  })

  // `0 %` would say the attacks were played and never scored.
  it('says an unrated type has no rating rather than a rate of zero', async () => {
    render(<NothingRated />)

    expect(await screen.findAllByText('Keine Bewertung')).toHaveLength(4)
    expect(screen.queryByText(/0 % mit Tor/)).toBeNull()
  })

  it('reports the play type that was picked', async () => {
    const user = userEvent.setup()
    const onSelect = fn()
    render(<Default onSelect={onSelect} />)

    await user.click(await screen.findByRole('button', { name: /Einläufer/ }))

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('einlaeufer')
  })

  it('marks the play type the report is drilled into', async () => {
    render(<DrilledIn />)

    const pressed = await screen.findAllByRole('button', { pressed: true })
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveTextContent('Kreuzen')
  })

  it('says nothing was detected when the summary is empty', async () => {
    render(<NoPlays />)

    expect(await screen.findByText('Noch keine Spielzüge erkannt')).toBeVisible()
    expect(screen.queryByText(/wels-plays/)).toBeNull()
  })

  // `db.py:28` empties every read while any match is processing, so the same
  // empty list cannot be read as "none detected".
  it('reads an empty list during ingestion as "not yet"', async () => {
    render(<Frozen />)

    expect(await screen.findByText('Noch nicht verfügbar')).toBeVisible()
    expect(screen.queryByText('Noch keine Spielzüge erkannt')).toBeNull()
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
    await screen.findByText('20 Szenen')

    await expectNoA11yViolations(container)
  })
})
