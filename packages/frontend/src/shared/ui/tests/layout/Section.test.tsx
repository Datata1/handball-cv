import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/layout/Section.stories'

const { Default, AsSubsection } = composeStories(stories)

describe('Section', () => {
  it('is a region labelled by its own heading', () => {
    render(<Default />)

    expect(screen.getByRole('region', { name: 'Ballbesitz' })).toBeVisible()
  })

  it('drops to h3 when nested under a section that owns the h2', () => {
    render(<AsSubsection />)

    expect(screen.getByRole('heading', { level: 3, name: 'Angriff' })).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)

    await expectNoA11yViolations(container)
  })
})
