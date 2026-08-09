import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type { VideoSource } from '@/stores'

import type { AnnotatedState } from '../video'

/**
 * Original ⇄ annotiert, which is the whole of the legacy report's output-video
 * tab.
 *
 * Absent when there is no render to switch to — a match ingested with
 * `annotate_video=false` never gets one — but *present and disabled* while one
 * is still being made, so the option is discoverable before it works.
 */
export function VideoSourceToggle({
  value,
  annotated,
  onChange,
  className,
}: {
  value: VideoSource
  annotated: AnnotatedState
  onChange: (source: VideoSource) => void
  className?: string
}) {
  const { t } = useTranslation('report')

  if (annotated === 'absent') return null

  const pending = annotated === 'processing'

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* biome-ignore lint/a11y/useSemanticElements: a <fieldset> is for form
          controls; two buttons that switch a view are what `group` is for. */}
      <div
        role="group"
        aria-label={t('video.sourceLabel')}
        className="inline-flex rounded-md border border-border p-0.5"
      >
        <SourceButton
          pressed={value === 'original'}
          onClick={() => onChange('original')}
        >
          {t('video.original')}
        </SourceButton>

        <SourceButton
          pressed={value === 'annotated'}
          disabled={pending}
          onClick={() => onChange('annotated')}
        >
          {t('video.annotated')}
        </SourceButton>
      </div>

      {/* Visible rather than an `aria-describedby` on the disabled button: a
          disabled control takes no focus, so its description is never read. */}
      {pending ? (
        <span className="text-xs text-muted-foreground">
          {t('video.annotatedPending')}
        </span>
      ) : null}
    </div>
  )
}

function SourceButton({
  pressed,
  disabled = false,
  onClick,
  children,
}: {
  pressed: boolean
  disabled?: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-sm px-3 py-1 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        pressed
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-50 hover:text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}
