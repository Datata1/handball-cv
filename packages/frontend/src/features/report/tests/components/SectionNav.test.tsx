import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/SectionNav.stories'

const { OverviewActive, HeatmapActive, FilteredSection } = composeStories(stories)

// findBy*, not getBy*: the story's router resolves its first match in an
// effect, so nothing is in the DOM on the render pass itself.
describe('SectionNav', () => {
  it('is a named navigation landmark', async () => {
    render(<OverviewActive />)

    expect(await screen.findByRole('navigation', { name: 'Abschnitte' })).toBeVisible()
  })

  it('points every tab at the match it was given', async () => {
    render(<OverviewActive />)

    expect(await screen.findByRole('link', { name: 'Angriff' })).toHaveAttribute(
      'href',
      '/matches/abc123/offense',
    )
  })

  it.each([
    ['Übersicht', OverviewActive],
    ['Heatmap', HeatmapActive],
  ])('marks %s as the current section', async (name, Story) => {
    render(<Story />)

    expect(await screen.findByRole('link', { name })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('stays current when the section carries a filter', async () => {
    render(<FilteredSection />)

    expect(await screen.findByRole('link', { name: 'Abwehr' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<OverviewActive />)
    await screen.findByRole('navigation')

    await expectNoA11yViolations(container)
  })
})
