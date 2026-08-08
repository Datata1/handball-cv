import type { PlayerStore } from './player'

/**
 * Mirrors a `<video>` element's clock into the store. Returns a disposer.
 *
 * Time comes from `requestVideoFrameCallback`, not `timeupdate`: the latter
 * fires at ~4Hz, which is enough to overshoot a clip end by ~250ms.
 */
export function bindVideoClock(
  video: HTMLVideoElement,
  player: PlayerStore,
): () => void {
  // Firefox still ships without rVFC, so this is a runtime check even though
  // lib.dom declares the method as always present.
  const perFrame = typeof video.requestVideoFrameCallback === 'function'
  let handle: number | undefined

  function schedule() {
    if (!perFrame || handle !== undefined || video.paused || video.ended) return
    handle = video.requestVideoFrameCallback(onFrame)
  }

  function onFrame() {
    handle = undefined
    player.setTime(video.currentTime)
    schedule()
  }

  function syncTime() {
    player.setTime(video.currentTime)
  }

  function syncDuration() {
    player.setDuration(video.duration)
  }

  function onPlay() {
    player.play()
    schedule()
  }

  function onPause() {
    player.pause()
  }

  video.addEventListener('play', onPlay)
  video.addEventListener('pause', onPause)
  video.addEventListener('ended', onPause)
  // rVFC only runs while frames are being rendered, so a seek while paused
  // needs its own event either way.
  video.addEventListener('seeked', syncTime)
  video.addEventListener('loadedmetadata', syncDuration)
  video.addEventListener('durationchange', syncDuration)
  if (!perFrame) video.addEventListener('timeupdate', syncTime)

  // The element may already be playing a loaded video — swapping the source
  // toggle rebinds a warm element.
  syncDuration()
  syncTime()
  if (!video.paused) onPlay()

  return () => {
    video.removeEventListener('play', onPlay)
    video.removeEventListener('pause', onPause)
    video.removeEventListener('ended', onPause)
    video.removeEventListener('seeked', syncTime)
    video.removeEventListener('loadedmetadata', syncDuration)
    video.removeEventListener('durationchange', syncDuration)
    video.removeEventListener('timeupdate', syncTime)

    if (perFrame && handle !== undefined) video.cancelVideoFrameCallback(handle)
    handle = undefined
  }
}
