import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { HeatmapSearch } from '@/features/report/search'
import { cn } from '@/lib/utils'

type Mode = HeatmapSearch['mode']
type Perspective = HeatmapSearch['perspective']

const MODES: Mode[] = ['density', 'tiles']
const PERSPECTIVES: Perspective[] = ['offense', 'defense', 'both']

/**
 * How the section is read, and — in the density view — which half of the game it
 * is read over.
 *
 * The tile view takes no filters at all: its zones come from `/stats`, which
 * summarises the whole match and has no parameters. Hiding the point-cloud
 * controls there is the honest form of that; the legacy app left them on screen
 * doing nothing.
 *
 * There is no phase `<select>` either. The report's shared timeline is the phase
 * picker, so this only reports which phase is active and offers a way out.
 */
export function HeatmapControls({
  mode,
  perspective,
  phaseLabel,
  onModeChange,
  onPerspectiveChange,
  onClearPhase,
  className,
}: {
  mode: Mode
  perspective: Perspective
  /** The active phase, already named by the caller; `null` for the whole match. */
  phaseLabel: string | null
  onModeChange: (mode: Mode) => void
  onPerspectiveChange: (perspective: Perspective) => void
  onClearPhase: () => void
  className?: string
}) {
  const { t } = useTranslation('heatmap')

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ToggleGroup label={t('mode.label')}>
          {MODES.map((value) => (
            <Toggle
              key={value}
              pressed={mode === value}
              onClick={() => onModeChange(value)}
            >
              {t(`mode.${value}`)}
            </Toggle>
          ))}
        </ToggleGroup>

        {mode === 'density' ? (
          <ToggleGroup label={t('perspective.label')}>
            {PERSPECTIVES.map((value) => (
              <Toggle
                key={value}
                pressed={perspective === value}
                onClick={() => onPerspectiveChange(value)}
              >
                {t(`perspective.${value}`)}
              </Toggle>
            ))}
          </ToggleGroup>
        ) : null}
      </div>

      {mode === 'density' ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{t('phase.label')}</span>
            {': '}
            <span>{phaseLabel ?? t('phase.all')}</span>
          </span>

          {phaseLabel === null ? (
            <span>{t('phase.hint')}</span>
          ) : (
            <Button type="button" variant="outline" size="xs" onClick={onClearPhase}>
              <X aria-hidden="true" />
              {t('phase.clear')}
            </Button>
          )}
        </p>
      ) : null}
    </div>
  )
}

function ToggleGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="text-sm text-muted-foreground">
        {label}
      </span>

      {/* biome-ignore lint/a11y/useSemanticElements: a <fieldset> is for form
          controls; buttons that switch a view are what `group` is for. */}
      <div
        role="group"
        aria-label={label}
        className="inline-flex rounded-md border border-border p-0.5"
      >
        {children}
      </div>
    </div>
  )
}

function Toggle({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'rounded-sm px-3 py-1 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        pressed
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
