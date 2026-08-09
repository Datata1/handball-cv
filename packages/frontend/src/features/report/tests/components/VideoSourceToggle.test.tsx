import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/VideoSourceToggle.stories'

const { Ready, OnAnnotated, Processing, Absent } = composeStories(stories)

describe('VideoSourceToggle', () => {
  it('groups the two sources under one name', async () => {
    render(<Ready />)

    expect(await screen.findByRole('group', { name: 'Videoquelle' })).toBeVisible()
  })

  it('says which source is playing', async () => {
    render(<OnAnnotated />)

    expect(await screen.findByRole('button', { name: 'Annotiert' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Original' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('asks for the other source when it is picked', async () => {
    const user = userEvent.setup()
    const onChange = fn()
    render(<Ready onChange={onChange} />)

    await user.click(await screen.findByRole('button', { name: 'Annotiert' }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith('annotated')
  })

  // Disabled rather than hidden, so a trainer learns the render is coming —
  // with the reason as visible text, since a disabled button takes no focus and
  // its description would never be read.
  it('disables the render while it is still being made, and says why', async () => {
    render(<Processing />)

    expect(await screen.findByRole('button', { name: 'Annotiert' })).toBeDisabled()
    expect(screen.getByText('Das annotierte Video wird noch erstellt.')).toBeVisible()
  })

  it('is absent when there is no render to switch to', () => {
    render(<Absent />)

    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Ready />)
    await screen.findByRole('group')

    await expectNoA11yViolations(container)
  })
})
