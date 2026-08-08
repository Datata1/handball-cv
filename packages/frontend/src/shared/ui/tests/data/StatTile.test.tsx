import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/data/StatTile.stories'

const { Default, WithUnit, NotMeasured, InAGrid } = composeStories(stories)

describe('StatTile', () => {
  it('shows the figure under its label', () => {
    render(<Default />)

    expect(screen.getByText('Tore gesamt')).toBeVisible()
    expect(screen.getByText('58')).toBeVisible()
  })

  it('keeps the unit out of the figure', () => {
    render(<WithUnit />)

    expect(screen.getByText('61:12')).toBeVisible()
    expect(screen.getByText('min')).toBeVisible()
  })

  it('says "no data" rather than showing a zero when nothing was measured', () => {
    render(<NotMeasured />)

    expect(screen.getByText('Keine Daten')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<InAGrid />)

    await expectNoA11yViolations(container)
  })
})
