import { composeStories } from '@storybook/react-vite'
import { fireEvent, render } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/MatchThumbnail.stories'

const { Loaded, Absent } = composeStories(stories)

describe('MatchThumbnail', () => {
  it('loads lazily and reserves its box, so the grid does not reflow', () => {
    const { container } = render(<Loaded />)

    const image = container.querySelector('img')
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).toHaveAttribute('decoding', 'async')
  })

  it('renders a placeholder for a match that has no frame to show yet', () => {
    const { container } = render(<Absent />)

    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  it('swaps a failed decode for the same placeholder', () => {
    const { container } = render(<Loaded />)

    const image = container.querySelector('img')
    if (!image) throw new Error('the story renders a thumbnail')
    fireEvent.error(image)

    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Loaded />)

    await expectNoA11yViolations(container)
  })
})
