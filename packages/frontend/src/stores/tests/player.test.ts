import { autorun } from 'mobx'

import { PlayerStore } from '../player'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PlayerStore', () => {
  // enforceActions reports rather than throws, so this is what "strict" buys:
  // a named field in the console instead of a component that never re-renders.
  it('reports a mutation outside an action once something observes it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const player = new PlayerStore()
    const stop = autorun(() => void player.currentTime)

    player.currentTime = 12

    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/strict-mode.+PlayerStore.+currentTime/s),
    )
    stop()
  })

  it('does not wake reactions for an unchanged time', () => {
    const player = new PlayerStore()
    const seen: number[] = []
    const stop = autorun(() => seen.push(player.currentTime))

    player.setTime(4)
    player.setTime(4)

    expect(seen).toEqual([0, 4])
    stop()
  })

  it('ignores a time the element cannot supply yet', () => {
    const player = new PlayerStore()

    player.setTime(Number.NaN)

    expect(player.currentTime).toBe(0)
  })

  // If isWithin were annotated as an action its reads would be untracked, and a
  // section highlighting "now" would never re-render.
  it('tracks time through isWithin', () => {
    const player = new PlayerStore()
    const seen: boolean[] = []
    const stop = autorun(() => seen.push(player.isWithin(5, 10)))

    player.setTime(7)
    player.setTime(10)

    expect(seen).toEqual([false, true, false])
    stop()
  })

  it('recomputes activeInterval only when the clip or the duration changes', () => {
    const compute = vi.spyOn(PlayerStore.prototype, 'activeInterval', 'get')
    const player = new PlayerStore()
    const stop = autorun(() => void player.activeInterval)

    expect(compute).toHaveBeenCalledOnce()

    player.setTime(30)
    expect(compute).toHaveBeenCalledOnce()

    player.setDuration(120)
    expect(compute).toHaveBeenCalledTimes(2)

    player.setClip({ start: 10, end: 20 })
    expect(compute).toHaveBeenCalledTimes(3)

    stop()
  })

  describe('seeking', () => {
    it('records the intent and moves the playhead ahead of the element', () => {
      const player = new PlayerStore()

      player.seek(42)

      expect(player.pendingSeek).toBe(42)
      expect(player.currentTime).toBe(42)
    })

    it('clamps to the duration once metadata has arrived', () => {
      const player = new PlayerStore()
      player.setDuration(90)

      player.seek(120)
      expect(player.currentTime).toBe(90)

      player.seek(-5)
      expect(player.currentTime).toBe(0)
    })

    it('clamps to the clip while one is set', () => {
      const player = new PlayerStore()
      player.setDuration(90)
      player.setClip({ start: 10, end: 20 })

      player.seek(80)

      expect(player.currentTime).toBe(20)
    })

    it('is cleared by the element that applied it', () => {
      const player = new PlayerStore()
      player.seek(42)

      player.clearSeek()

      expect(player.pendingSeek).toBeNull()
    })
  })

  describe('clips', () => {
    it('jumps to the start when the playhead is outside the new clip', () => {
      const player = new PlayerStore()
      player.setDuration(90)

      player.setClip({ start: 30, end: 40 })

      expect(player.currentTime).toBe(30)
      expect(player.pendingSeek).toBe(30)
    })

    it('leaves a playhead that is already inside it alone', () => {
      const player = new PlayerStore()
      player.setDuration(90)
      player.seek(35)
      player.clearSeek()

      player.setClip({ start: 30, end: 40 })

      expect(player.currentTime).toBe(35)
      expect(player.pendingSeek).toBeNull()
    })

    it('stops and rewinds on the first frame past the end', () => {
      const player = new PlayerStore()
      player.setDuration(90)
      player.setClip({ start: 10, end: 20 })
      player.play()

      player.setTime(19.98)
      expect(player.playing).toBe(true)

      player.setTime(20.02)

      expect(player.playing).toBe(false)
      expect(player.currentTime).toBe(10)
      expect(player.pendingSeek).toBe(10)
    })

    it('pulls a playhead that drifted before the start back in', () => {
      const player = new PlayerStore()
      player.setDuration(90)
      player.setClip({ start: 10, end: 20 })

      player.setTime(3)

      expect(player.currentTime).toBe(10)
      expect(player.pendingSeek).toBe(10)
    })

    it('runs free again once the clip is cleared', () => {
      const player = new PlayerStore()
      player.setDuration(90)
      player.setClip({ start: 10, end: 20 })
      player.play()

      player.clearClip()
      player.setTime(45)

      expect(player.currentTime).toBe(45)
      expect(player.playing).toBe(true)
      expect(player.activeInterval).toEqual({ start: 0, end: 90 })
    })
  })

  it('toggles transport and source', () => {
    const player = new PlayerStore()

    player.togglePlay()
    expect(player.playing).toBe(true)
    player.pause()
    expect(player.playing).toBe(false)

    player.setSource('annotated')
    expect(player.source).toBe('annotated')
  })

  it('resets for a different video', () => {
    const player = new PlayerStore()
    player.setDuration(90)
    player.setClip({ start: 10, end: 20 })
    player.play()

    player.reset()

    expect(player).toMatchObject({
      currentTime: 0,
      duration: 0,
      playing: false,
      clip: null,
      pendingSeek: null,
    })
  })
})
