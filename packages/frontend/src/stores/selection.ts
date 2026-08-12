import { makeAutoObservable } from 'mobx'

import './configure'

/**
 * Which timeline item is highlighted right now.
 *
 * It is shared state because the two ends of it sit in different routes: the
 * report shell draws the one timeline, and a section below it is what decides
 * a scene is worth pointing at. Passing it down would mean lifting it into the
 * shell and threading a callback through the `<Outlet/>`, which the router does
 * not offer.
 *
 * Only the id travels. The item itself is server data and stays in Query.
 */
export class SelectionStore {
  /** A `TimelineItem.id`, unique across tracks. */
  timelineItemId: string | null = null

  constructor() {
    makeAutoObservable(this)
  }

  select(id: string | null): void {
    this.timelineItemId = id
  }

  clear(): void {
    this.timelineItemId = null
  }
}
