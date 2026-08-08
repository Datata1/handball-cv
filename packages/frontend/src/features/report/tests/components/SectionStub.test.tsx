import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/SectionStub.stories'

const { Default } = composeStories(stories)

describe('SectionStub', () => {
  it('gives the section its heading even before it has content', () => {
    render(<Default />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Abwehr')
  })

  it('says the section is unbuilt rather than empty of data', () => {
    render(<Default />)

    expect(screen.getByText('Dieser Bereich ist noch nicht gebaut.')).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)

    await expectNoA11yViolations(container)
  })
})
