import { isNavKey, moveCursor } from '../navigation'

const TRACKS = [
  { items: [{ start: 10 }, { start: 200 }, { start: 900 }] },
  { items: [] },
  { items: [{ start: 180 }, { start: 880 }] },
]

describe('isNavKey', () => {
  it('claims only the keys the timeline moves on', () => {
    expect(isNavKey('ArrowUp')).toBe(true)
    expect(isNavKey('End')).toBe(true)
    expect(isNavKey('Enter')).toBe(false)
    expect(isNavKey('a')).toBe(false)
  })
})

describe('moveCursor', () => {
  it('steps along a track', () => {
    expect(moveCursor(TRACKS, { track: 0, item: 0 }, 'ArrowRight')).toEqual({
      track: 0,
      item: 1,
    })
    expect(moveCursor(TRACKS, { track: 0, item: 1 }, 'ArrowLeft')).toEqual({
      track: 0,
      item: 0,
    })
  })

  it('stops at the ends instead of wrapping', () => {
    expect(moveCursor(TRACKS, { track: 0, item: 0 }, 'ArrowLeft')).toEqual({
      track: 0,
      item: 0,
    })
    expect(moveCursor(TRACKS, { track: 0, item: 2 }, 'ArrowRight')).toEqual({
      track: 0,
      item: 2,
    })
  })

  it('jumps to the first and last item of the track', () => {
    expect(moveCursor(TRACKS, { track: 0, item: 1 }, 'Home')).toEqual({
      track: 0,
      item: 0,
    })
    expect(moveCursor(TRACKS, { track: 0, item: 1 }, 'End')).toEqual({
      track: 0,
      item: 2,
    })
  })

  it('lands on the item nearest in time in the next populated track', () => {
    // Skips the empty track, and 200s is closer to 180s than to 880s.
    expect(moveCursor(TRACKS, { track: 0, item: 1 }, 'ArrowDown')).toEqual({
      track: 2,
      item: 0,
    })
    expect(moveCursor(TRACKS, { track: 0, item: 2 }, 'ArrowDown')).toEqual({
      track: 2,
      item: 1,
    })
  })

  it('stays put when there is no track left in that direction', () => {
    expect(moveCursor(TRACKS, { track: 0, item: 0 }, 'ArrowUp')).toEqual({
      track: 0,
      item: 0,
    })
    expect(moveCursor(TRACKS, { track: 2, item: 0 }, 'ArrowDown')).toEqual({
      track: 2,
      item: 0,
    })
  })

  it('refuses to move out of a track that holds nothing', () => {
    expect(moveCursor(TRACKS, { track: 1, item: 0 }, 'ArrowRight')).toEqual({
      track: 1,
      item: 0,
    })
  })
})
