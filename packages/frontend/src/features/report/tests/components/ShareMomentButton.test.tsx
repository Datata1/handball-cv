import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/ShareMomentButton.stories'

const { Default, AtStart } = composeStories(stories)

describe('ShareMomentButton', () => {
  it('shows the position it would link to', async () => {
    render(<Default />)

    expect(await screen.findByText('12:34')).toBeVisible()
  })

  // Whole seconds, so the URL a trainer copies stays readable — and so the
  // button re-renders once a second rather than once a frame.
  it('hands the playhead over as whole seconds', async () => {
    const user = userEvent.setup()
    const onShare = fn()
    render(<Default onShare={onShare} />)

    await user.click(
      await screen.findByRole('button', { name: 'Diesen Moment verlinken' }),
    )

    expect(onShare).toHaveBeenCalledExactlyOnceWith(754)
  })

  it('reads zero before anything has played', async () => {
    render(<AtStart />)

    expect(await screen.findByText('00:00')).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByRole('button')

    await expectNoA11yViolations(container)
  })
})
