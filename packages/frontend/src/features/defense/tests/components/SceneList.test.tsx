import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fn } from 'storybook/test'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/SceneList.stories'

const { Default, Selected, NoScenes, Loading, Failed } = composeStories(stories)

describe('SceneList', () => {
  it('numbers the scenes and gives each its window and length', async () => {
    render(<Default />)

    const scenes = await screen.findAllByRole('button')
    expect(scenes).toHaveLength(2)
    expect(scenes[0]).toHaveTextContent('102:00 – 04:30150 s')
    expect(screen.getByText('2 Szenen in dieser Formation.')).toBeVisible()
  })

  it('reports the scene that was picked', async () => {
    const user = userEvent.setup()
    const onSelect = fn()
    render(<Default onSelect={onSelect} />)

    await user.click((await screen.findAllByRole('button'))[1])

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect.mock.calls[0][0]).toMatchObject({ scene_id: 5 })
  })

  // The clip has to be releasable from the same control that armed it, or a
  // trainer is stuck inside 84 seconds of the match.
  it('clears the selection when the selected scene is picked again', async () => {
    const user = userEvent.setup()
    const onSelect = fn()
    render(<Selected onSelect={onSelect} />)

    const selected = await screen.findByRole('button', { pressed: true })
    await user.click(selected)

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('says so when the formation was classified but never ran', async () => {
    render(<NoScenes />)

    expect(await screen.findByText('Keine Szenen gespeichert')).toBeVisible()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('announces the wait', () => {
    render(<Loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('offers a retry when the request failed', async () => {
    const user = userEvent.setup()
    const onRetry = fn()
    render(<Failed onRetry={onRetry} />)

    await user.click(await screen.findByRole('button', { name: 'Erneut versuchen' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findAllByRole('button')

    await expectNoA11yViolations(container)
  })
})
