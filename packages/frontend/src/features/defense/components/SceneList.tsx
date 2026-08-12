import { Film } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { FormationScene } from '@/shared/api'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui'
import { formatClock } from '@/shared/video'

import { sceneDuration } from '../formations'

/**
 * The runs of one formation, as things to watch.
 *
 * Selecting one drives the report's single player and its timeline — there is
 * no video in here. The legacy accordion mounted a `ScenePlayer` per expanded
 * row, so a match could end up with several videos decoding at once.
 */
export function SceneList({
  scenes,
  error,
  frozen = false,
  onRetry,
  selectedId,
  onSelect,
}: {
  scenes: FormationScene[] | undefined
  error?: unknown
  frozen?: boolean
  onRetry?: () => void
  /** `scene_id` of the scene the player is clipped to. */
  selectedId: number | null
  /** `null` when the selected scene is picked again, which releases the clip. */
  onSelect: (scene: FormationScene | null) => void
}) {
  const { t } = useTranslation('defense')
  const { t: tCommon } = useTranslation()

  if (error !== undefined && error !== null) {
    return <ErrorState error={error} processing={frozen} onRetry={onRetry} />
  }

  if (scenes === undefined) return <LoadingState lines={4} label={t('loading')} />

  // The endpoint answers `[]` rather than 404 here, so an empty list is a real
  // statement: the label was classified, no continuous run was stored.
  if (scenes.length === 0) {
    return (
      <EmptyState
        icon={<Film />}
        title={t('scenes.empty.title')}
        description={t('scenes.empty.description')}
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('scenes.hint')}</p>

      <ul className="space-y-2">
        {scenes.map((scene, index) => {
          const selected = scene.scene_id === selectedId

          return (
            <li key={scene.scene_id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : scene)}
                className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-muted"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground tabular-nums">
                  {index + 1}
                </span>

                <span className="min-w-0 flex-1 truncate font-medium tabular-nums">
                  {t('scenes.window', {
                    start: formatClock(scene.start_time_s),
                    end: formatClock(scene.end_time_s),
                  })}
                </span>

                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {tCommon('units.seconds', {
                    value: Math.round(sceneDuration(scene)),
                  })}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="text-sm text-muted-foreground">
        {t('scenes.caption', { count: scenes.length })}
      </p>
    </div>
  )
}
