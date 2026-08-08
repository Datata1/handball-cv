import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/data/SplitBar.stories'

const { Default, CustomValueLabels, NothingMeasured } = composeStories(stories)

describe('SplitBar', () => {
  it('normalises raw counts into two shares that add up', () => {
    render(<Default />)

    expect(screen.getByText('56 %')).toBeVisible()
    expect(screen.getByText('44 %')).toBeVisible()
  })

  it('lets each side carry its own figure instead', () => {
    render(<CustomValueLabels />)

    expect(screen.getByText('30:40 min')).toBeVisible()
    expect(screen.getByText('23:40 min')).toBeVisible()
  })

  it('shows zero on both sides rather than an even split', () => {
    render(<NothingMeasured />)

    expect(screen.getAllByText('0 %')).toHaveLength(2)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)

    await expectNoA11yViolations(container)
  })
})
