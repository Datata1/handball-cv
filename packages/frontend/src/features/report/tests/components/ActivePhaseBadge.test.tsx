import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/ActivePhaseBadge.stories'

const { InPhase, OtherTeamAttacking, BetweenPhases, NoPhases } = composeStories(stories)

describe('ActivePhaseBadge', () => {
  it('names who is attacking and who is defending at this moment', async () => {
    render(<InPhase />)

    expect(await screen.findByText('Angriff: HSG Nord')).toBeVisible()
    expect(screen.getByText('Abwehr: TV Süd')).toBeVisible()
  })

  it('follows the playhead into the next phase', async () => {
    render(<OtherTeamAttacking />)

    expect(await screen.findByText('Angriff: TV Süd')).toBeVisible()
  })

  it('calls the gap between two phases what it is', async () => {
    render(<BetweenPhases />)

    expect(await screen.findByText('Umschaltspiel')).toBeVisible()
  })

  it('says nothing at all for a match that was never scored', () => {
    render(<NoPhases />)

    expect(screen.queryByText('Umschaltspiel')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<InPhase />)
    await screen.findByText('Angriff: HSG Nord')

    await expectNoA11yViolations(container)
  })
})
