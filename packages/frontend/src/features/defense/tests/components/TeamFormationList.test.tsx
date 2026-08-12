import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/TeamFormationList.stories'

const { Default, Selected, NoFormations } = composeStories(stories)

describe('TeamFormationList', () => {
  it('names the team the trainer named and counts what was classified', async () => {
    render(<Default />)

    expect(await screen.findByRole('heading', { name: 'HSG Nord' })).toBeVisible()
    expect(screen.getByText('27.600 klassifizierte Frames')).toBeVisible()
  })

  it('marks the most-used shape once', async () => {
    render(<Default />)

    const dominant = await screen.findAllByText('Häufigste')
    expect(dominant).toHaveLength(1)
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('6-0')
  })

  it('presses the formation the report is drilled into', async () => {
    render(<Selected />)

    expect(await screen.findByRole('button', { pressed: true })).toHaveTextContent(
      '6-0',
    )
  })

  it('says so for a team that was never classified into a shape', async () => {
    render(<NoFormations />)

    expect(
      await screen.findByText(
        'Für diese Mannschaft wurde keine Abwehrformation klassifiziert.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByRole('heading', { name: 'HSG Nord' })

    await expectNoA11yViolations(container)
  })
})
