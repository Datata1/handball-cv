import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'

import * as stories from '../../stories/components/ReportPlayer.stories'

const {
  Default,
  NoAnnotatedVideo,
  AnnotatedStillRendering,
  MatchProcessing,
  MatchFailed,
} = composeStories(stories)

const ORIGINAL = 'Spielvideo, Originalaufnahme'
const ANNOTATED = 'Spielvideo mit erkannten Spielern'

describe('ReportPlayer', () => {
  it('plays the original recording by default', async () => {
    render(<Default />)

    // Named outright: the endpoint's own default prefers the render, so a
    // toggle that left the parameter off could not hold the original.
    expect((await screen.findByLabelText(ORIGINAL)).getAttribute('src')).toContain(
      'source=original',
    )
  })

  it('swaps the file under the element when the source changes', async () => {
    const user = userEvent.setup()
    render(<Default />)

    await user.click(await screen.findByRole('button', { name: 'Annotiert' }))

    expect((await screen.findByLabelText(ANNOTATED)).getAttribute('src')).toContain(
      'source=annotated',
    )
  })

  it('offers no toggle for a match that has no render', async () => {
    render(<NoAnnotatedVideo />)

    await screen.findByLabelText(ORIGINAL)
    expect(screen.queryByRole('group', { name: 'Videoquelle' })).not.toBeInTheDocument()
  })

  it('shows the toggle disabled while the render is still being made', async () => {
    render(<AnnotatedStillRendering />)

    expect(await screen.findByRole('button', { name: 'Annotiert' })).toBeDisabled()
  })

  it('shows what is happening instead of an empty player while ingesting', async () => {
    render(<MatchProcessing />)

    expect(await screen.findByText('Das Spiel wird noch verarbeitet')).toBeVisible()
    expect(screen.queryByLabelText(ORIGINAL)).not.toBeInTheDocument()
  })

  it('says a failed match has nothing to play', async () => {
    render(<MatchFailed />)

    expect(await screen.findByText('Kein abspielbares Video')).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Default />)
    await screen.findByLabelText(ORIGINAL)

    await expectNoA11yViolations(container)
  })
})
