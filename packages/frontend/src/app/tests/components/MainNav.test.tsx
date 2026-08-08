import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/MainNav.stories'

const { DashboardActive, UploadActive, InsideAReport } = composeStories(stories)

// findBy*, not getBy*: the story's router resolves its first match in an
// effect, so nothing is in the DOM on the render pass itself.
describe('MainNav', () => {
  it('renders real links rather than click handlers', async () => {
    render(<DashboardActive />)

    expect(await screen.findByRole('link', { name: 'Übersicht' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('link', { name: 'Upload' })).toHaveAttribute(
      'href',
      '/upload',
    )
  })

  it.each([
    ['the dashboard', DashboardActive, 'Übersicht'],
    ['upload', UploadActive, 'Upload'],
  ])('marks %s as the current page', async (_case, Story, name) => {
    render(<Story />)

    expect(await screen.findByRole('link', { name })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('marks nothing current on a URL neither link owns', async () => {
    render(<InsideAReport />)

    await screen.findByRole('link', { name: 'Übersicht' })

    expect(screen.queryByRole('link', { current: 'page' })).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<DashboardActive />)
    await screen.findByRole('link', { name: 'Upload' })

    await expectNoA11yViolations(container)
  })
})
