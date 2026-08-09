import { composeStories } from '@storybook/react-vite'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { expectNoA11yViolations } from '@/testing/axe'
import { type MediaDriver, stubMedia } from '@/testing/media'

import * as stories from '../stories/ClippedVideo.stories'

const { Default, Clipped, LoopingScene, WithTimeline } = composeStories(stories)

const CLIP = { start: 724, end: 751 }
const SCENE = { start: 1_284.5, end: 1_298 }

let media: MediaDriver

beforeEach(() => {
  media = stubMedia()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function player(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector('video')
  if (video === null) throw new Error('no player rendered')
  return video
}

/** Playback, one rendered frame per time given. */
function play(video: HTMLVideoElement, ...times: number[]): void {
  act(() => {
    void video.play()
    for (const time of times) media.frame(video, time)
  })
}

describe('ClippedVideo', () => {
  it('names the player and keeps the native controls', () => {
    const { container } = render(<Default />)
    const video = player(container)

    expect(video).toHaveAttribute('aria-label', 'Spielvideo')
    expect(video).toHaveAttribute('controls')
  })

  it('takes the clip start even when the element loads at zero', () => {
    const { container } = render(<Clipped />)
    const video = player(container)

    // Setting currentTime before metadata only records a default start
    // position, and a source swap puts the element back to the beginning.
    video.currentTime = 0
    media.metadata(video, 3_600)

    expect(video.currentTime).toBe(CLIP.start)
  })

  it('stops and rewinds on the frame the clip runs out, not a quarter second later', () => {
    const { container } = render(<Clipped />)
    const video = player(container)
    media.metadata(video, 3_600)

    play(video, 740, CLIP.end + 0.02)

    expect(video.paused).toBe(true)
    expect(video.currentTime).toBe(CLIP.start)
  })

  it('carries straight on from the start when the scene loops', () => {
    const { container } = render(<LoopingScene />)
    const video = player(container)
    media.metadata(video, 3_600)

    play(video, 1_290, SCENE.end + 0.02)

    expect(video.paused).toBe(false)
    expect(video.currentTime).toBe(SCENE.start)
  })

  it('leaves an unclipped match to run to the end', () => {
    const { container } = render(<Default />)
    const video = player(container)
    media.metadata(video, 3_600)

    play(video, 2_000, 3_000)

    expect(video.paused).toBe(false)
    expect(video.currentTime).toBe(3_000)
  })

  it('says which window it is playing', () => {
    render(<Clipped />)

    expect(screen.getByText('Ausschnitt 12:04 bis 12:31')).toBeVisible()
  })

  it('reports nothing about a window when there is none', () => {
    render(<Default />)

    expect(screen.queryByText(/^Ausschnitt/)).not.toBeInTheDocument()
  })

  describe('paired with the timeline', () => {
    it('seeks the element when an interval is selected', async () => {
      const user = userEvent.setup()
      const { container } = render(<WithTimeline />)
      const video = player(container)
      media.metadata(video, 2_400)

      await user.click(
        screen.getByRole('button', {
          name: 'Phase 3, Team A Angriff, 15:00 bis 15:48',
        }),
      )

      expect(video.currentTime).toBe(900)
    })

    it('moves the playhead as the element reports frames', () => {
      const { container } = render(<WithTimeline />)
      const video = player(container)
      media.metadata(video, 2_400)

      play(video, 600)

      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '10:00')
    })
  })

  it.each([
    ['unclipped', <Default key="default" />],
    ['clipped to a phase', <Clipped key="clipped" />],
    ['beside the timeline', <WithTimeline key="paired" />],
  ])('has no accessibility violations %s', async (_name, ui) => {
    const { container } = render(ui)

    await expectNoA11yViolations(container)
  })
})
