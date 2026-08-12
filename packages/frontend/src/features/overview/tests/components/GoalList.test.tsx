import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/GoalList.stories'
import { goals } from '../../stories/overview'

const { Default, NoGoals } = composeStories(stories)

describe('GoalList', () => {
  it('lists every goal with its clock, its team and the score after it', async () => {
    render(<Default />)

    expect(
      await screen.findByRole('button', { name: 'Spielzeit 02:18, Heim, 1:0' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Spielzeit 06:42, Gast, 1:1' }),
    ).toBeVisible()
    expect(screen.getAllByRole('button')).toHaveLength(goals.length)
  })

  // Two clocks: the OCR reads the hall's, the file has its own. A goal whose
  // game time was never read still has to be findable in the video.
  it('falls back to the video position when the clock was not read', async () => {
    render(<Default />)

    expect(
      await screen.findByRole('button', { name: 'Videozeit 20:48, Gast, 3:2' }),
    ).toBeVisible()
  })

  it('hands the picked goal to its caller', async () => {
    const user = userEvent.setup()
    const onSelect = fn()
    render(<Default onSelect={onSelect} />)

    await user.click(
      await screen.findByRole('button', { name: 'Spielzeit 06:42, Gast, 1:1' }),
    )

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(goals[1])
  })

  it('says so when the scoreboard was read and nobody scored', async () => {
    render(<NoGoals />)

    expect(await screen.findByText('Keine Tore erkannt.')).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByRole('button', { name: 'Spielzeit 02:18, Heim, 1:0' })

    await expectNoA11yViolations(container)
  })
})
