import { observer } from 'mobx-react-lite'

import { Timeline, type TimelineProps } from '@/shared/video'
import { usePlayer, useSelection } from '@/stores'

/**
 * The match's timeline, scaled by whichever length is known and highlighting
 * whatever the report currently points at.
 *
 * The meta row gives the length, except while the read freeze empties that
 * row — and then the element's own metadata is the only source, which is why
 * this reads the player at all.
 *
 * Selection is read from the store rather than taken as a prop because a
 * section renders below the `<Outlet/>`, not above this: picking a formation
 * scene in the defense section has to reach the one timeline the shell drew.
 */
export const ReportTimeline = observer(function ReportTimeline({
  duration,
  ...props
}: Omit<TimelineProps, 'selectedId' | 'onSelect'>) {
  const player = usePlayer()
  const selection = useSelection()

  return (
    <Timeline
      duration={duration > 0 ? duration : player.duration}
      selectedId={selection.timelineItemId}
      onSelect={(selected) => selection.select(selected?.item.id ?? null)}
      {...props}
    />
  )
})
