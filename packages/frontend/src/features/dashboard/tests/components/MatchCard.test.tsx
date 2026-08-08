import { composeStories } from '@storybook/react-vite'
import { fireEvent, render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/MatchCard.stories'

const { Default, WithoutScore, Unnamed, Processing, Failed, MissingThumbnail } =
  composeStories(stories)

describe('MatchCard', () => {
  it('links a finished match to its report', async () => {
    render(<Default />)

    expect(
      await screen.findByRole('link', { name: 'Testspiel Nord vs Süd' }),
    ).toHaveAttribute('href', '/matches/seed01')
  })

  it('shows the score and the duration it measured', async () => {
    render(<Default />)

    expect(await screen.findByText('24')).toBeVisible()
    expect(screen.getByText('22')).toBeVisible()
    expect(screen.getByText('01:00')).toBeVisible()
  })

  it('shows no score for a match without scoreboard readings', async () => {
    render(<WithoutScore />)

    await screen.findByRole('link')
    expect(screen.queryByText('Spielstand')).not.toBeInTheDocument()
  })

  it('names an unnamed match after its file', async () => {
    render(<Unnamed />)

    expect(
      await screen.findByRole('link', { name: 'aufzeichnung-2026-05-02.mp4' }),
    ).toBeVisible()
  })

  it.each([
    ['processing', Processing, 'Wird verarbeitet'],
    ['failed', Failed, 'Fehlgeschlagen'],
  ])('renders a %s stub row without a link', async (_status, Story, label) => {
    render(<Story />)

    expect(await screen.findByText(label)).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('names a stub row after its id, since it has no file name yet', async () => {
    render(<Processing />)

    expect(await screen.findByRole('heading', { level: 3 })).toHaveTextContent(
      'pending9',
    )
  })

  it('falls back to a placeholder when the thumbnail cannot be decoded', async () => {
    const { container } = render(<MissingThumbnail />)
    await screen.findByRole('link')

    // Decorative, so it has no role to query by — the title link names the card.
    const image = container.querySelector('img')
    if (!image) throw new Error('the story renders a thumbnail')
    fireEvent.error(image)

    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByRole('link')

    await expectNoA11yViolations(container)
  })
})
