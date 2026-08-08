import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/StatusBadge.stories'

const { Done, Processing, Failed, Unknown } = composeStories(stories)

describe('StatusBadge', () => {
  it.each([
    ['Fertig', Done],
    ['Wird verarbeitet', Processing],
    ['Fehlgeschlagen', Failed],
    ['Unbekannt', Unknown],
  ])('writes the status out as %s rather than relying on colour', (label, Story) => {
    render(<Story />)

    expect(screen.getByText(label)).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Processing />)

    await expectNoA11yViolations(container)
  })
})
