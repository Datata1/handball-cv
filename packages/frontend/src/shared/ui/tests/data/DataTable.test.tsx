import { composeStories } from '@storybook/react-vite'
import { render, screen, within } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/data/DataTable.stories'

const { Default, HiddenCaption, NoRows, NoRowsWithOwnMessage } = composeStories(stories)

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

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)

    await expectNoA11yViolations(container)
  })
})
