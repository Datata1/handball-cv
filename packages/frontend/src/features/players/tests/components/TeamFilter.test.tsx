import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/TeamFilter.stories'

const { Default, TeamSelected, OnlyUnassigned, UnknownTeamId, SelectedTeamAbsent } =
  composeStories(stories)

const filter = () => screen.getByRole('combobox', { name: 'Mannschaft' })

describe('TeamFilter', () => {
  it('offers every bucket plus the unfiltered view', () => {
    render(<Default />)

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Alle Mannschaften',
      'HSG Nord',
      'TV Süd',
      'Ohne Teamzuordnung',
    ])
  })

  it('reports the picked team', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Default onSelect={onSelect} />)

    await user.selectOptions(filter(), 'B')

    expect(onSelect).toHaveBeenCalledWith('B')
  })

  // "All" is the absence of a filter, not a value the URL should carry.
  it('reports no team at all when the filter is cleared', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<TeamSelected onSelect={onSelect} />)

    await user.selectOptions(filter(), 'Alle Mannschaften')

    expect(onSelect).toHaveBeenCalledWith(undefined)
  })

  it('names the bucket for tracks the classifier never placed', () => {
    render(<OnlyUnassigned />)

    expect(screen.getByRole('option', { name: 'Ohne Teamzuordnung' })).toBeVisible()
  })

  // The label set is the backend's, so an id no dictionary knows is shown raw
  // rather than dropped.
  it('offers a team id nobody knows', () => {
    render(<UnknownTeamId />)

    expect(screen.getByRole('option', { name: 'C' })).toBeVisible()
  })

  // The select would otherwise fall back to "all" while the table stays filtered.
  it('shows a selected team no track carries', () => {
    render(<SelectedTeamAbsent />)

    expect(filter()).toHaveValue('C')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)

    await expectNoA11yViolations(container)
  })
})
