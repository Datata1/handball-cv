import { composeStories } from '@storybook/react-vite'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { type MediaDriver, stubMedia } from '@/testing/media'

import * as pairStories from '../stories/ClippedVideo.stories'
import * as stories from '../stories/Timeline.stories'

const rowRenders = vi.hoisted(() => vi.fn())

// The whole point of the playhead being its own observer is that the tracks
// around it stay still during playback, and only a render count can show that.
vi.mock('../TimelineTrackRow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../TimelineTrackRow')>()

  return {
    ...actual,
    TimelineTrackRow: (props: Parameters<typeof actual.TimelineTrackRow>[0]) => {
      rowRenders()
      return actual.TimelineTrackRow(props)
    },
  }
})

const { AllTracks } = composeStories(stories)
const { WithTimeline } = composeStories(pairStories)

/** The story parks the playhead on the fourth goal, at 21:24 of a 60' match. */
const START = '21:24'

let media: MediaDriver

beforeEach(() => {
  rowRenders.mockClear()
  media = stubMedia()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function focusPlayhead(): HTMLElement {
  const slider = screen.getByRole('slider')
  slider.focus()
  return slider
}

describe('Playhead', () => {
  it('reports its position in seconds and as a clock', () => {
    render(<AllTracks />)
    const slider = screen.getByRole('slider')

    expect(slider).toHaveAttribute('aria-label', 'Abspielposition')
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', '3600')
    expect(slider).toHaveAttribute('aria-valuenow', '1284')
    expect(slider).toHaveAttribute('aria-valuetext', START)
  })

  it.each([
    ['{ArrowRight}', '21:29'],
    ['{ArrowLeft}', '21:19'],
    ['{Shift>}{ArrowRight}{/Shift}', '21:25'],
    ['{PageUp}', '21:54'],
    ['{PageDown}', '20:54'],
    ['{Home}', '00:00'],
    ['{End}', '60:00'],
  ])('scrubs on %s', async (keys, expected) => {
    const user = userEvent.setup()
    render(<AllTracks />)
    focusPlayhead()

    await user.keyboard(keys)

    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', expected)
  })

  it('follows the element frame by frame', () => {
    const { container } = render(<WithTimeline />)
    const video = container.querySelector('video')
    if (video === null) throw new Error('no player rendered')
    media.metadata(video, 2_400)

    const rendered = rowRenders.mock.calls.length

    act(() => {
      void video.play()
      media.frame(video, 100)
      media.frame(video, 200.5)
    })

    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '03:20')
    // Playback moved the playhead twice and the tracks not at all.
    expect(rowRenders).toHaveBeenCalledTimes(rendered)
  })
})
