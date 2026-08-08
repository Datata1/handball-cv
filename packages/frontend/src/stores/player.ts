import { makeAutoObservable } from 'mobx'

import './configure'

export type VideoSource = 'original' | 'annotated'

export interface Interval {
  start: number
  end: number
}

/**
 * The video's clock and transport state.
 *
 * The `<video>` element owns the truth: `seek()` records an intent that
 * `ClippedVideo` applies to the element, and the element's own events feed the
 * store back through `bindVideoClock`. Nothing here ever comes from HTTP.
 */
export class PlayerStore {
  currentTime = 0
  duration = 0
  playing = false
  source: VideoSource = 'original'
  /** Set while a scene plays; playback stays inside it. */
  clip: Interval | null = null
  /** A requested position the element has not applied yet. */
  pendingSeek: number | null = null

  constructor() {
    // `isWithin` must not become an action: an action does not track its reads,
    // so an observer calling it would never re-render as time advances.
    makeAutoObservable(this, { isWithin: false })
  }

  /** The window playback is confined to — the clip, or the whole video. */
  get activeInterval(): Interval {
    return this.clip ?? { start: 0, end: this.duration }
  }

  /** Whether the playhead sits in `[start, end)`, i.e. what is on screen now. */
  isWithin(start: number, end: number): boolean {
    return this.currentTime >= start && this.currentTime < end
  }

  setTime(time: number): void {
    if (!Number.isFinite(time) || time === this.currentTime) return
    this.currentTime = time

    const clip = this.clip
    if (!clip) return

    if (time < clip.start) {
      this.seek(clip.start)
    } else if (time >= clip.end) {
      // The frame callback lands within one frame of the boundary: stop there
      // and rewind, leaving the clip armed to play again.
      this.playing = false
      this.seek(clip.start)
    }
  }

  setDuration(duration: number): void {
    if (!Number.isFinite(duration) || duration < 0) return
    this.duration = duration
  }

  seek(time: number): void {
    const { start, end } = this.activeInterval
    // duration stays 0 until the element reports metadata, so only a known end
    // clamps.
    const target = Math.min(Math.max(time, start), end > start ? end : Infinity)

    this.pendingSeek = target
    // Optimistic, so dragging the playhead feels immediate; the element's next
    // frame confirms it.
    this.currentTime = target
  }

  /** `ClippedVideo` applies `pendingSeek` to the element, then clears it here. */
  clearSeek(): void {
    this.pendingSeek = null
  }

  play(): void {
    this.playing = true
  }

  pause(): void {
    this.playing = false
  }

  togglePlay(): void {
    this.playing = !this.playing
  }

  setSource(source: VideoSource): void {
    this.source = source
  }

  setClip(clip: Interval): void {
    this.clip = clip
    if (!this.isWithin(clip.start, clip.end)) this.seek(clip.start)
  }

  clearClip(): void {
    this.clip = null
  }

  /** For when the element gets a different video — a new match, not a source toggle. */
  reset(): void {
    this.currentTime = 0
    this.duration = 0
    this.playing = false
    this.clip = null
    this.pendingSeek = null
  }
}
