import { vi } from 'vitest'

export type MediaDriver = {
  /** The element has loaded enough to know how long it is. */
  metadata: (video: HTMLVideoElement, duration: number) => void
  /** One rendered frame at `time`, running whatever asked for the next one. */
  frame: (video: HTMLVideoElement, time: number) => void
  /** The user dragged the native scrub bar. */
  seeked: (video: HTMLVideoElement, time: number) => void
}

/**
 * A `<video>` element with a clock, for an environment that has neither.
 *
 * jsdom implements `play` and `pause` as "not implemented" stubs, never changes
 * `paused`, and has no `requestVideoFrameCallback` at all — so a test driving
 * the real player would be driving nothing. This replaces the four pieces the
 * player touches and hands back the driver a test needs to play the browser's
 * part: metadata arriving, frames being rendered, the user scrubbing.
 *
 * Install it *before* rendering — the player picks its frame source when it
 * binds, on mount. The frame callbacks stay on the prototype for the rest of
 * the file (vitest gives each one its own jsdom), which is deliberate: they
 * have to outlive the unmount that cancels them.
 */
export function stubMedia(): MediaDriver {
  const frames = new Set<() => void>()
  const media = HTMLMediaElement.prototype
  const video = HTMLVideoElement.prototype

  vi.spyOn(media, 'play').mockImplementation(function play(this: HTMLMediaElement) {
    setPaused(this, false)
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })

  vi.spyOn(media, 'pause').mockImplementation(function pause(this: HTMLMediaElement) {
    setPaused(this, true)
    this.dispatchEvent(new Event('pause'))
  })

  // Defined rather than spied: jsdom has no such method to spy on, and its
  // absence is exactly what sends the player down the `timeupdate` fallback.
  Object.defineProperty(video, 'requestVideoFrameCallback', {
    configurable: true,
    value: (callback: () => void) => {
      frames.add(callback)
      return frames.size
    },
  })

  Object.defineProperty(video, 'cancelVideoFrameCallback', {
    configurable: true,
    value: () => frames.clear(),
  })

  return {
    metadata(element, duration) {
      Object.defineProperty(element, 'duration', {
        configurable: true,
        value: duration,
      })
      element.dispatchEvent(new Event('loadedmetadata'))
    },

    frame(element, time) {
      element.currentTime = time

      // One generation at a time: a callback that asks for the next frame must
      // not also run inside this one.
      const pending = [...frames]
      frames.clear()
      for (const callback of pending) callback()
    },

    seeked(element, time) {
      element.currentTime = time
      element.dispatchEvent(new Event('seeked'))
    },
  }
}

function setPaused(element: HTMLMediaElement, paused: boolean): void {
  Object.defineProperty(element, 'paused', { configurable: true, value: paused })
}
