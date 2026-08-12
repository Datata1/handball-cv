import { autorun } from 'mobx'

import { SelectionStore } from '../selection'

describe('SelectionStore', () => {
  it('holds the id of the highlighted timeline item', () => {
    const selection = new SelectionStore()

    expect(selection.timelineItemId).toBeNull()

    selection.select('formation-5')
    expect(selection.timelineItemId).toBe('formation-5')

    selection.clear()
    expect(selection.timelineItemId).toBeNull()
  })

  // The point of the store: the shell draws the timeline, a section decides
  // what it points at, and neither renders inside the other.
  it('notifies whoever is watching', () => {
    const selection = new SelectionStore()
    const seen: (string | null)[] = []

    const stop = autorun(() => seen.push(selection.timelineItemId))
    selection.select('play-11')
    selection.select(null)
    stop()

    expect(seen).toEqual([null, 'play-11', null])
  })
})
