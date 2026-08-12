import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatClock } from '@/shared/video'

/** Long enough that dragging a slider is one navigation, not forty. */
export const WINDOW_DEBOUNCE_MS = 200

const STEP_S = 1

export interface TimeWindowBounds {
  start: number
  end: number
}

/**
 * The slice of the match the point cloud is drawn from.
 *
 * The URL owns the window; the drag does not. While a slider is moving, the
 * draft below is what the inputs show, and only the settled value is written —
 * debounced and replacing rather than pushing, or a single drag would bury the
 * back button under forty history entries.
 *
 * The two bounds are always written together: the backend ignores a lone one,
 * which would quietly show more of the match than the URL claims.
 */
export function TimeWindow({
  bounds,
  from,
  to,
  onChange,
  delayMs = WINDOW_DEBOUNCE_MS,
  className,
}: {
  /** What "the whole thing" means here — the selected phase, or the match. */
  bounds: TimeWindowBounds
  from: number | undefined
  to: number | undefined
  onChange: (window: { from: number; to: number } | null) => void
  delayMs?: number
  className?: string
}) {
  const { t } = useTranslation('heatmap')
  const titleId = useId()
  const fromId = useId()
  const toId = useId()

  const start = from ?? bounds.start
  const end = to ?? bounds.end

  const [draft, setDraft] = useState({ start, end })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // The URL can change without this component: a deep link, the back button, or
  // a phase whose bounds are narrower than the window that was set.
  useEffect(() => {
    setDraft({ start, end })
  }, [start, end])

  useEffect(() => () => clearTimeout(timer.current), [])

  function commit(next: { start: number; end: number }) {
    setDraft(next)
    clearTimeout(timer.current)

    timer.current = setTimeout(() => {
      const whole = next.start <= bounds.start && next.end >= bounds.end

      onChange(whole ? null : { from: next.start, to: next.end })
    }, delayMs)
  }

  const setStart = (value: number) =>
    commit({ start: clamp(value, bounds.start, draft.end), end: draft.end })

  const setEnd = (value: number) =>
    commit({ start: draft.start, end: clamp(value, draft.start, bounds.end) })

  function reset() {
    clearTimeout(timer.current)
    setDraft({ start: bounds.start, end: bounds.end })
    onChange(null)
  }

  const filtered = from !== undefined && to !== undefined

  return (
    <section aria-labelledby={titleId} className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={titleId} className="font-medium">
          {t('window.title')}
        </h3>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground tabular-nums">
            {t('window.current', {
              start: formatClock(draft.start),
              end: formatClock(draft.end),
            })}
          </span>

          {filtered ? (
            <Button type="button" variant="outline" size="xs" onClick={reset}>
              {t('window.reset')}
            </Button>
          ) : null}
        </div>
      </div>

      <Bound
        id={fromId}
        label={t('window.from')}
        exactLabel={t('window.fromSeconds')}
        value={draft.start}
        min={bounds.start}
        max={draft.end}
        onChange={setStart}
      />

      <Bound
        id={toId}
        label={t('window.to')}
        exactLabel={t('window.toSeconds')}
        value={draft.end}
        min={draft.start}
        max={bounds.end}
        onChange={setEnd}
      />
    </section>
  )
}

/**
 * One end of the window, twice over: a slider to find a moment and a number to
 * name one. They carry different accessible names because they are two controls
 * for one value, not one control announced twice.
 */
function Bound({
  id,
  label,
  exactLabel,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  exactLabel: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Label htmlFor={id} className="w-10 shrink-0 text-muted-foreground text-sm">
        {label}
      </Label>

      <input
        id={id}
        type="range"
        min={min}
        max={Math.max(min, max)}
        step={STEP_S}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 min-w-0 flex-1 accent-primary"
      />

      <Input
        type="number"
        aria-label={exactLabel}
        min={min}
        max={Math.max(min, max)}
        step={STEP_S}
        value={Math.round(value)}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
        className="h-8 w-24 shrink-0 tabular-nums"
      />
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}
