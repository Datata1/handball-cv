import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/DashboardSummary.stories'

const { Measured, NothingMeasured } = composeStories(stories)

describe('DashboardSummary', () => {
  it('shows the figures it has', () => {
    render(<Measured />)

    expect(screen.getByText('12')).toBeVisible()
    expect(screen.getByText('738')).toBeVisible()
    expect(screen.getByText('07.08.2026')).toBeVisible()
  })

  it('says a figure was never measured rather than showing a zero', () => {
    render(<NothingMeasured />)

    expect(screen.getAllByText('Keine Daten')).toHaveLength(2)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Measured />)

    await expectNoA11yViolations(container)
  })
})
