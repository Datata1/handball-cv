import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/ConnectionIndicator.stories'

const { Interrupted, Live, Connecting, InHeader } = composeStories(stories)

describe('ConnectionIndicator', () => {
  it('announces a dropped stream as a live region', () => {
    render(<Interrupted />)

    expect(screen.getByRole('status')).toHaveTextContent('Verbindung unterbrochen')
  })

  it('explains to screen readers that it will retry on its own', () => {
    render(<Interrupted />)

    expect(
      screen.getByText(/Es wird erneut verbunden/, { selector: '.sr-only' }),
    ).toBeInTheDocument()
  })

  it.each([
    ['live', Live],
    ['connecting', Connecting],
  ])('renders nothing while %s', (_state, Story) => {
    render(<Story />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<InHeader />)

    await expectNoA11yViolations(container)
  })
})
