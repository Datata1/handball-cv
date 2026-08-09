import { Clapperboard, Loader2 } from 'lucide-react'
import { runInAction } from 'mobx'
import { observer } from 'mobx-react-lite'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { MatchStatus, TeamPhase } from '@/shared/api'
import { EmptyState } from '@/shared/ui'
import { ClippedVideo } from '@/shared/video'
import { usePlayer, type VideoSource } from '@/stores'

import type { TeamName } from '../teams'
import { type AnnotatedState, videoSrc } from '../video'
import { ActivePhaseBadge } from './ActivePhaseBadge'
import { ShareMomentButton } from './ShareMomentButton'
import { VideoSourceToggle } from './VideoSourceToggle'

/**
 * The one video in the report, with the two controls that belong to the match
 * rather than to a section.
 *
 * An `observer` for the source only: the clock is read by the playhead and the
 * phase badge, each of which re-renders on its own.
 */
export const ReportPlayer = observer(function ReportPlayer({
  matchId,
  status,
  annotated,
  phases,
  teamName,
  onShareMoment,
}: {
  matchId: string
  status: MatchStatus
  annotated: AnnotatedState
  phases: readonly TeamPhase[]
  teamName: TeamName
  onShareMoment: (seconds: number) => void
}) {
  const { t } = useTranslation('report')
  const player = usePlayer()

  // Where the old file was when the toggle swapped it out; see `videoSrc`.
  const [resumeAt, setResumeAt] = useState<number | null>(null)

  if (status !== 'done') {
    const ingesting = status === 'processing'

    return (
      <EmptyState
        icon={ingesting ? <Loader2 /> : <Clapperboard />}
        title={t(ingesting ? 'video.processing.title' : 'video.unavailable.title')}
        description={t(
          ingesting ? 'video.processing.description' : 'video.unavailable.description',
        )}
      />
    )
  }

  // The render can disappear under a toggle that is already on it — a refetch
  // during ingestion, or a match whose annotated file was deleted.
  const source = annotated === 'ready' ? player.source : 'original'

  function switchSource(next: VideoSource) {
    if (next === player.source) return

    // Reading an observable outside a derivation is what
    // `observableRequiresReaction` flags; an action is the sanctioned way to
    // take a one-off snapshot of one.
    setResumeAt(runInAction(() => player.currentTime))
    player.setSource(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ActivePhaseBadge phases={phases} teamName={teamName} />

        <div className="flex flex-wrap items-center gap-3">
          <ShareMomentButton onShare={onShareMoment} />
          <VideoSourceToggle
            value={source}
            annotated={annotated}
            onChange={switchSource}
          />
        </div>
      </div>

      <ClippedVideo
        src={videoSrc(matchId, source, resumeAt)}
        label={t(
          source === 'annotated' ? 'video.annotatedLabel' : 'video.originalLabel',
        )}
      />
    </div>
  )
})
