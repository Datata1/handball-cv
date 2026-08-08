import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/MatchFilters.stories'

const { Default, Searching, SortedByName } = composeStories(stories)

describe('MatchFilters', () => {
  it('reports every keystroke, so the URL can hold the search', async () => {
    const onQueryChange = vi.fn()
    render(<Default onQueryChange={onQueryChange} />)

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Spiele durchsuchen' }),
      'N',
    )

    expect(onQueryChange).toHaveBeenCalledWith('N')
  })

  it('shows the search the URL already carries', () => {
    render(<Searching />)

    expect(screen.getByRole('searchbox')).toHaveValue('Nord')
  })

  it('reports a change of order', async () => {
    const onSortChange = vi.fn()
    render(<Default onSortChange={onSortChange} />)

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Sortierung' }),
      'name',
    )

    expect(onSortChange).toHaveBeenCalledWith('name')
  })

  it('shows the order the URL already carries', () => {
    render(<SortedByName />)

    expect(screen.getByRole('combobox')).toHaveValue('name')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Searching />)

    await expectNoA11yViolations(container)
  })
})
