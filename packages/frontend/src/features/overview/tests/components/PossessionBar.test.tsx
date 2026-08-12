import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/PossessionBar.stories'

const { Default, FullyAssigned, NotMeasured } = composeStories(stories)

describe('PossessionBar', () => {
  it('labels each side with the team name and its measured share', async () => {
    render(<Default />)

    expect(await screen.findByText('HSG Nord')).toBeVisible()
    expect(screen.getByText('54,3 %')).toBeVisible()
    expect(screen.getByText('TV Süd')).toBeVisible()
    expect(screen.getByText('41,2 %')).toBeVisible()
  })

  // The two shares are counted over frames that had a ball holder, so a holder
  // the classifier never placed is missing from both.
  it('names the share that belongs to neither team', async () => {
    render(<Default />)

    expect(await screen.findByText('4,5 % ohne Teamzuordnung')).toBeVisible()
  })

  it('says nothing about unassigned possession when there is none', async () => {
    render(<FullyAssigned />)

    await screen.findByText('57,5 %')
    expect(screen.queryByText(/ohne Teamzuordnung/)).not.toBeInTheDocument()
  })

  it('renders an empty state rather than 0 % against 0 %', async () => {
    render(<NotMeasured />)

    expect(await screen.findByText('Kein Ballbesitz gemessen')).toBeVisible()
    expect(screen.queryByText('0 %')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByText('HSG Nord')

    await expectNoA11yViolations(container)
  })
})
