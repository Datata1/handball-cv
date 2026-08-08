import { PlayerStore } from '../player'
import { bindVideoClock } from '../video-clock'

/** jsdom has no media stack, so the element is stood in for. */
class FakeVideo extends EventTarget {
  currentTime = 0
  duration = Number.NaN
  paused = true
  ended = false

  private handles = new Map<number, () => void>()
  private nextHandle = 1

  requestVideoFrameCallback(callback: () => void): number {
    const handle = this.nextHandle++
    this.handles.set(handle, callback)
    return handle
  }

  cancelVideoFrameCallback(handle: number): void {
    this.handles.delete(handle)
  }

  get pendingFrames(): number {
    return this.handles.size
  }

  /** One rendered frame at `time`. */
  frame(time: number): void {
    this.currentTime = time
    const due = [...this.handles.values()]
    this.handles.clear()
    for (const callback of due) callback()
  }

  emit(type: string): void {
    this.dispatchEvent(new Event(type))
  }

  start(): void {
    this.paused = false
    this.emit('play')
  }
}

function fakeVideo({ perFrame = true } = {}) {
  const video = new FakeVideo()
  // Firefox has no rVFC; the clock falls back to timeupdate there.
  if (!perFrame) {
    Object.defineProperty(video, 'requestVideoFrameCallback', { value: undefined })
  }
  return video
}

function bind(video: FakeVideo) {
  const player = new PlayerStore()
  return {
    player,
    dispose: bindVideoClock(video as unknown as HTMLVideoElement, player),
  }
}

describe('bindVideoClock', () => {
  it('follows the element frame by frame while it plays', () => {
    const video = fakeVideo()
    const { player } = bind(video)

    video.start()
    expect(player.playing).toBe(true)

    video.frame(1.5)
    expect(player.currentTime).toBe(1.5)

    video.frame(2)
    expect(player.currentTime).toBe(2)
  })

  it('takes the duration from the element, not before it is known', () => {
    const video = fakeVideo()
    const { player } = bind(video)

    expect(player.duration).toBe(0)

    video.duration = 90
    video.emit('loadedmetadata')

    expect(player.duration).toBe(90)
  })

  it('adopts an element that is already playing a loaded video', () => {
    const video = fakeVideo()
    video.duration = 90
    video.currentTime = 12
    video.paused = false

    const { player } = bind(video)

    expect(player).toMatchObject({ duration: 90, currentTime: 12, playing: true })
  })

  it('lands a clip boundary within one frame', () => {
    const video = fakeVideo()
    const { player } = bind(video)
    player.setClip({ start: 10, end: 20 })

    video.start()
    video.frame(19.96)
    expect(player.playing).toBe(true)

    video.frame(20)

    expect(player.playing).toBe(false)
    expect(player.pendingSeek).toBe(10)
  })

  it('mirrors a seek made while the element is paused', () => {
    const video = fakeVideo()
    const { player } = bind(video)

    video.currentTime = 33
    video.emit('seeked')

    expect(player.currentTime).toBe(33)
  })

  it('stops on pause and on ended', () => {
    const video = fakeVideo()
    const { player } = bind(video)

    video.start()
    video.paused = true
    video.emit('pause')
    expect(player.playing).toBe(false)

    video.start()
    video.emit('ended')
    expect(player.playing).toBe(false)
  })

  it('falls back to timeupdate where rVFC is missing', () => {
    const video = fakeVideo({ perFrame: false })
    const { player } = bind(video)

    video.start()
    video.currentTime = 4
    video.emit('timeupdate')

    expect(player.currentTime).toBe(4)
    expect(video.pendingFrames).toBe(0)
  })

  it('ignores timeupdate where rVFC drives the clock', () => {
    const video = fakeVideo()
    const { player } = bind(video)

    video.start()
    video.currentTime = 4
    video.emit('timeupdate')

    expect(player.currentTime).toBe(0)
  })

  it('detaches on dispose, leaving no frame callback armed', () => {
    const video = fakeVideo()
    const { player, dispose } = bind(video)
    video.start()

    dispose()

    expect(video.pendingFrames).toBe(0)

    video.frame(30)
    video.emit('pause')

    expect(player.currentTime).toBe(0)
    expect(player.playing).toBe(true)
  })
})
