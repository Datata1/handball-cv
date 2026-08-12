import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { TeamName } from '@/features/report/teams'
import type { AvailableTrack } from '@/shared/api'
import { EmptyState, LoadingState } from '@/shared/ui'
import { formatClock } from '@/shared/video'

import { asTrackParam, toggleBucket, toggleTrack, trackBuckets } from '../tracks'

/**
 * Which tracks the point cloud is drawn from.
 *
 * One list per team bucket, built by mapping over the buckets the response
 * actually contains — the legacy version was three copy-pasted columns, so a
 * team id the classifier invents had nowhere to go.
 *
 * A track is not a player: an occlusion or a camera cut ends one and starts
 * another, which is why the rows carry the window a track was alive for.
 */
export function TrackFilter({
  tracks,
  selected,
  onChange,
  teamName,
}: {
  /** `undefined` while the point cloud is loading; the section owns its error. */
  tracks: AvailableTrack[] | undefined
  /** The `?tracks=` list; `undefined` means every track is counted. */
  selected: number[] | undefined
  onChange: (tracks: number[] | undefined) => void
  teamName: TeamName
}) {
  const { t } = useTranslation('heatmap')
  const { t: tCommon } = useTranslation()
  const titleId = useId()

  const chosen = useMemo(() => selected ?? [], [selected])
  const buckets = useMemo(() => trackBuckets(tracks ?? [], chosen), [tracks, chosen])

  if (tracks === undefined) {
    return <LoadingState lines={4} label={t('tracks.loading')} />
  }

  if (tracks.length === 0) {
    return (
      <EmptyState
        title={t('tracks.empty.title')}
        description={t('tracks.empty.description')}
      />
    )
  }

  // An empty list is no filter to this backend, so `undefined` is the only way
  // to say "all of them" and the picker has no "none".
  const apply = (next: number[]) => onChange(asTrackParam(next))

  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={titleId} className="font-medium">
          {t('tracks.title')}
        </h3>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {chosen.length === 0
              ? t('tracks.hint')
              : t('tracks.selected', { count: chosen.length, total: tracks.length })}
          </span>

          {chosen.length === 0 ? null : (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onChange(undefined)}
            >
              {t('tracks.clear')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {buckets.map((bucket) => (
          <div
            key={bucket.team}
            className="space-y-2 rounded-lg border border-border p-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="truncate font-medium text-sm">{teamName(bucket.team)}</h4>

              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={() => apply(toggleBucket(chosen, bucket))}
              >
                {bucket.selected === bucket.tracks.length
                  ? t('tracks.clearTeam')
                  : t('tracks.selectTeam')}
              </Button>
            </div>

            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {bucket.tracks.map((track) => (
                <TrackRow
                  key={track.track_id}
                  track={track}
                  checked={chosen.includes(track.track_id)}
                  onToggle={() => apply(toggleTrack(chosen, track.track_id))}
                  frames={tCommon('units.frames', { count: track.frame_count })}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function TrackRow({
  track,
  checked,
  onToggle,
  frames,
}: {
  track: AvailableTrack
  checked: boolean
  onToggle: () => void
  frames: string
}) {
  const { t } = useTranslation('heatmap')
  const id = useId()

  return (
    <li className="flex items-start gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} className="mt-1" />

      {/* The label names the track; the window and the frame count sit inside it
          so a screen reader gets what a sighted trainer picks a track by. */}
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-sm">
        <span className="font-medium tabular-nums">
          {t('tracks.track', { id: track.track_id })}
        </span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {t('tracks.range', {
            start: formatClock(track.first_time_s),
            end: formatClock(track.last_time_s),
          })}
          {' · '}
          {frames}
        </span>
      </label>
    </li>
  )
}
