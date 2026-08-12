import { composeStories } from '@storybook/react-vite'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/data/DataTable.stories'

const { Default, HiddenCaption, NoRows, NoRowsWithOwnMessage, Sorted } =
  composeStories(stories)

describe('DataTable', () => {
  it('names the table by its caption', () => {
    render(<Default />)

    expect(screen.getByRole('table', { name: 'Erkannte Tracks' })).toBeVisible()
  })

  it('renders one row per record plus the header row', () => {
    render(<Default />)

    expect(screen.getAllByRole('row')).toHaveLength(5)
  })

  it('keeps the accessible name when the caption is visually hidden', () => {
    render(<HiddenCaption />)

    expect(screen.getByRole('table', { name: 'Erkannte Tracks' })).toBeInTheDocument()
  })

  it('falls back to the shared empty copy with no rows', () => {
    render(<NoRows />)

    expect(within(screen.getByRole('table')).getByText('Keine Daten')).toBeVisible()
  })

  it('prefers the caller’s own empty message', () => {
    render(<NoRowsWithOwnMessage />)

    expect(
      screen.getByText('Für diesen Abschnitt wurde kein Track erkannt.'),
    ).toBeVisible()
  })

  it('leaves the headers as plain text when nothing sorts the rows', () => {
    render(<Default />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByRole('columnheader', { name: 'Frames' })).not.toHaveAttribute(
      'aria-sort',
    )
  })

  it('announces the sorted column on its header, not on the button', () => {
    render(<Sorted />)

    expect(screen.getByRole('columnheader', { name: 'Frames' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    expect(screen.getByRole('columnheader', { name: 'Track' })).toHaveAttribute(
      'aria-sort',
      'none',
    )
  })

  it('reports the column a header was pressed on', async () => {
    const user = userEvent.setup()
    const onSort = vi.fn()
    render(<Sorted sort={{ columnId: 'frames', direction: 'descending', onSort }} />)

    await user.click(screen.getByRole('button', { name: 'Track' }))

    expect(onSort).toHaveBeenCalledWith('id')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)

    await expectNoA11yViolations(container)
  })

  it('has no accessibility violations while sorted', async () => {
    const { container } = render(<Sorted />)

    await expectNoA11yViolations(container)
  })
})
