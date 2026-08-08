import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/state/InlineError.stories'

const { Default, UnderAField } = composeStories(stories)

describe('InlineError', () => {
  it('announces itself', () => {
    render(<Default />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Der Name konnte nicht gespeichert werden.',
    )
  })

  it('describes the field it is wired to', () => {
    render(<UnderAField />)

    expect(
      screen.getByRole('textbox', { name: 'Heimmannschaft' }),
    ).toHaveAccessibleDescription('Der Name konnte nicht gespeichert werden.')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<UnderAField />)

    await expectNoA11yViolations(container)
  })
})
