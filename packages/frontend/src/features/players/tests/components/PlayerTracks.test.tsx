import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/PlayerTracks.stories'

const {
  Default,
  FilteredToOneTeam,
  FilteredToNothing,
  UnplacedTracks,
  NoTracks,
  Loading,
  Failed,
  Frozen,
} = composeStories(stories)

const rowCount = () => screen.getAllByRole('row').length - 1

describe('PlayerTracks', () => {
  it('shows every track the endpoint returned', async () => {
    render(<Default />)

    await screen.findByText('#3')
    expect(rowCount()).toBe(25)
    expect(screen.getByText('25 Tracks')).toBeVisible()
  })

  it('narrows the table to one team and says how many are left', async () => {
    render(<FilteredToOneTeam />)

    await screen.findByText('#3')
    expect(rowCount()).toBe(11)
    expect(screen.getByText('11 von 25 Tracks')).toBeVisible()
  })

  it('reports the team that was picked', async () => {
    const user = userEvent.setup()
    const onTeamChange = vi.fn()
    render(<Default onTeamChange={onTeamChange} />)

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Mannschaft' }),
      'B',
    )

    expect(onTeamChange).toHaveBeenCalledWith('B')
  })

  it('reports the column a header was pressed on', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(<Default onSortChange={onSortChange} />)

    await user.click(await screen.findByRole('button', { name: 'Ø Konfidenz' }))

    expect(onSortChange).toHaveBeenCalledWith('confidence')
  })

  // A filter that matched nothing is not the same as a match with no tracks:
  // the filter has to stay reachable so it can be undone.
  it('keeps the filter when it matched no track', async () => {
    render(<FilteredToNothing />)

    expect(
      await screen.findByText('Für diese Auswahl wurde kein Track gespeichert.'),
    ).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Mannschaft' })).toBeVisible()
    expect(screen.getByText('0 von 25 Tracks')).toBeVisible()
  })

  it('handles a match in which no track was placed at all', async () => {
    render(<UnplacedTracks />)

    await screen.findByText('#33')
    expect(screen.getAllByText('Ohne Teamzuordnung').length).toBeGreaterThan(0)
  })

  // Not an error and not an empty grid: the rows are missing because nothing
  // was stored, which points at the pipeline rather than at this view.
  it('says what is missing when there is no track at all', () => {
    render(<NoTracks />)

    expect(screen.getByText('Keine Tracks gespeichert')).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('announces the wait', () => {
    render(<Loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('offers a retry when the request failed', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<Failed onRetry={onRetry} />)

    await user.click(await screen.findByRole('button', { name: 'Erneut versuchen' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('reads a 404 during ingestion as "not yet", not "not found"', async () => {
    render(<Frozen />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Noch nicht verfügbar')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByText('#3')

    await expectNoA11yViolations(container)
  })
})
