import { observer } from 'mobx-react-lite'

import { Timeline, type TimelineProps } from '@/shared/video'
import { usePlayer } from '@/stores'

/**
 * The match's timeline, scaled by whichever length is known.
 *
 * The meta row gives it, except while the read freeze empties that row — and
 * then the element's own metadata is the only source, which is why this reads
 * the store at all.
 */
export const ReportTimeline = observer(function ReportTimeline({
  duration,
  ...props
}: TimelineProps) {
  const player = usePlayer()

  return <Timeline duration={duration > 0 ? duration : player.duration} {...props} />
})
