import { composeStories } from '@storybook/react-vite'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/MatchList.stories'

const { Default, MixedStatuses, Loading, Empty, NoSearchResults, Failed, ServerError } =
  composeStories(stories)

describe('MatchList', () => {
  it('renders one card per match', async () => {
    render(<Default />)

    expect(await screen.findAllByRole('heading', { level: 3 })).toHaveLength(2)
  })

  it('opens only the matches that finished ingesting', async () => {
    render(<MixedStatuses />)

    await screen.findAllByRole('heading', { level: 3 })
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('announces the first load instead of flashing a spinner', async () => {
    render(<Loading />)

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Spiele werden geladen…',
    )
  })

  it('points an empty dashboard at the upload page', async () => {
    render(<Empty />)

    expect(
      await screen.findByRole('link', { name: 'Video hochladen' }),
    ).toHaveAttribute('href', '/upload')
  })

  it('distinguishes an empty search from an empty dashboard', async () => {
    render(<NoSearchResults />)

    expect(await screen.findByText('Keine Treffer')).toBeVisible()
    expect(
      screen.queryByRole('link', { name: 'Video hochladen' }),
    ).not.toBeInTheDocument()
  })

  it('reports a failed load as an alert', async () => {
    render(<Failed />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Der Server ist nicht erreichbar.',
    )
  })

  it('offers a retry when one is wired up', async () => {
    const onRetry = vi.fn()
    render(<ServerError onRetry={onRetry} />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Erneut versuchen' }),
    )

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it.each([
    ['a list', Default],
    ['mixed statuses', MixedStatuses],
    ['the loading state', Loading],
    ['the empty state', Empty],
    ['an error', Failed],
  ])('has no accessibility violations rendering %s', async (_name, Story) => {
    const { container } = render(<Story />)
    // The stories' router resolves its first match in an effect, so nothing is
    // in the DOM on the render pass itself.
    await waitFor(() => expect(container.firstChild).not.toBeNull())

    await expectNoA11yViolations(container)
  })
})
