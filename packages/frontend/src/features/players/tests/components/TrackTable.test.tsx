import { composeStories } from '@storybook/react-vite'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/TrackTable.stories'

const { Default, FewRows, SortedByDistance, ExtremeValues, NoRowsInFilter } =
  composeStories(stories)

/** The header row plus one row per track. */
const rowCount = () => screen.getAllByRole('row').length - 1

describe('TrackTable', () => {
  it('renders one row per track, with the figures the endpoint measured', async () => {
    render(<Default />)

    const row = (await screen.findByText('#3')).closest('tr')
    expect(row).not.toBeNull()

    const cells = within(row as HTMLElement).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toEqual([
      '#3',
      'HSG Nord',
      '41.200',
      '88,4 %',
      '4.312,6 m',
    ])
  })

  // A track the classifier never placed is a fact about the tracking, not a
  // blank: `null` and its `"unknown"` both have to say so.
  it('names the bucket for a track with no team', async () => {
    render(<Default />)

    expect(await screen.findAllByText('Ohne Teamzuordnung')).toHaveLength(3)
  })

  it('discloses that the endpoint caps the list at 25', async () => {
    render(<Default />)

    expect(
      await screen.findByRole('table', { name: /höchstens 25 davon/ }),
    ).toBeVisible()
    expect(rowCount()).toBe(25)
  })

  it('marks the column the rows are ordered by', async () => {
    render(<Default />)

    expect(
      await screen.findByRole('columnheader', { name: 'Frames sichtbar' }),
    ).toHaveAttribute('aria-sort', 'descending')
    expect(screen.getByRole('columnheader', { name: 'Distanz' })).toHaveAttribute(
      'aria-sort',
      'none',
    )
  })

  it('reports the column whose header was pressed', async () => {
    const user = userEvent.setup()
    const onSort = vi.fn()
    render(<Default onSort={onSort} />)

    await user.click(await screen.findByRole('button', { name: 'Distanz' }))

    expect(onSort).toHaveBeenCalledWith('distance')
  })

  it('orders the rows the caller handed it, not one of its own', async () => {
    render(<SortedByDistance />)

    expect(
      await screen.findByRole('columnheader', { name: 'Distanz' }),
    ).toHaveAttribute('aria-sort', 'ascending')
  })

  it('renders a handful of rows', async () => {
    render(<FewRows />)

    await screen.findByText('#3')
    expect(rowCount()).toBe(3)
  })

  it('survives the ends of every column', async () => {
    render(<ExtremeValues />)

    expect(await screen.findByText('59.998')).toBeVisible()
    expect(screen.getByText('0,1 m')).toBeVisible()
    expect(screen.getByText('0,0 %')).toBeVisible()
  })

  it('keeps the columns when a filter matched nothing', async () => {
    render(<NoRowsInFilter />)

    expect(
      await screen.findByText('Für diese Auswahl wurde kein Track gespeichert.'),
    ).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Track-ID' })).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByText('#3')

    await expectNoA11yViolations(container)
  })
})
