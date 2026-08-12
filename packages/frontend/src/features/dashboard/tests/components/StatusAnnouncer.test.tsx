import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/StatusAnnouncer.stories'
import { done, failed, processing } from '../../stories/matches'

const { Default, Loading } = composeStories(stories)

describe('StatusAnnouncer', () => {
  it('says nothing about the list it started with', () => {
    render(<Default />)

    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('names a match that finished', () => {
    const { rerender } = render(
      <Default matches={[{ ...done, status: 'processing' }]} />,
    )

    rerender(<Default matches={[done]} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Analyse fertig: Testspiel Nord vs Süd.',
    )
  })

  it('names a match that failed', () => {
    const { rerender } = render(<Default matches={[processing]} />)

    rerender(<Default matches={[failed, processing]} />)

    expect(screen.getByRole('status')).toHaveTextContent('Analyse fehlgeschlagen')
  })

  // An upload that finished in another tab: the row is new to this list, and
  // nothing on screen announced it either.
  it('names a match that appeared mid-ingestion', () => {
    const { rerender } = render(<Default matches={[done]} />)

    rerender(<Default matches={[done, processing]} />)

    expect(screen.getByRole('status')).toHaveTextContent('wird jetzt verarbeitet')
  })

  it('stays quiet when a refetch changed nothing', () => {
    const { rerender } = render(<Default matches={[done, failed]} />)

    rerender(<Default matches={[{ ...done }, { ...failed }]} />)

    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('waits for a list before comparing anything', () => {
    const { rerender } = render(<Loading />)

    rerender(<Loading matches={[done]} />)

    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)

    await expectNoA11yViolations(container)
  })
})
