import { Pencil, X } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { InlineError } from '../state/InlineError'

const TONES = {
  light: {
    input: '',
    placeholder: 'text-muted-foreground',
    trigger: 'hover:bg-accent hover:text-accent-foreground',
  },
  dark: {
    input:
      'border-white/40 bg-white/10 text-inherit placeholder:text-white/70 selection:bg-white/30',
    placeholder: 'text-white/70',
    trigger: 'hover:bg-white/10',
  },
} as const

/**
 * A value that turns into an input when you click it.
 *
 * Enter commits, Escape reverts, blur commits — except when the blur came from
 * pressing cancel, which is what `cancelled` guards: the button's mousedown
 * fires before the input's blur, so without it every cancel would save.
 */
export function EditableField({
  value,
  label,
  placeholder,
  onSave,
  pending = false,
  error,
  tone = 'light',
  className,
}: {
  value: string
  /** The field's accessible name — "Heimmannschaft", not "Name". */
  label: string
  placeholder?: ReactNode
  onSave: (next: string) => void
  pending?: boolean
  error?: ReactNode
  /** `dark` places the field on the navy chrome instead of on a card. */
  tone?: keyof typeof TONES
  className?: string
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const errorId = useId()
  const tones = TONES[tone]

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const cancelled = useRef(false)
  const restoreFocus = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      input.current?.focus()
      // Selected, not just focused: the common edit is a full replacement.
      input.current?.select()
      return
    }

    // Only the keyboard paths (Enter, Escape, cancel) ask for focus back — a
    // blur-commit means focus already went where the user sent it.
    if (!restoreFocus.current) return
    restoreFocus.current = false
    trigger.current?.focus()
  }, [editing])

  function startEditing() {
    setDraft(value)
    cancelled.current = false
    setEditing(true)
  }

  function commit(returnFocus: boolean) {
    restoreFocus.current = returnFocus
    setEditing(false)

    const next = draft.trim()
    if (next !== value) onSave(next)
  }

  function cancel(returnFocus: boolean) {
    cancelled.current = true
    restoreFocus.current = returnFocus
    setDraft(value)
    setEditing(false)
  }

  return (
    <span className={cn('inline-flex flex-col items-start gap-1', className)}>
      {editing ? (
        <span className="inline-flex items-center gap-1">
          <Label htmlFor={fieldId} className="sr-only">
            {label}
          </Label>

          <Input
            ref={input}
            id={fieldId}
            value={draft}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== 'Escape') return

              // Cancelling the keydown suppresses the keypress that follows.
              // Without it the key lands on the trigger we are about to focus,
              // and Enter on a button means "press it" — reopening the editor.
              event.preventDefault()

              if (event.key === 'Enter') commit(true)
              else cancel(true)
            }}
            onBlur={() => {
              if (!cancelled.current) commit(false)
            }}
            className={cn('h-8 w-48 text-sm', tones.input)}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('actions.cancel')}
            // preventDefault keeps focus on the input, so the blur that follows
            // is the one we cause below — after `cancelled` is set.
            onMouseDown={(event) => {
              event.preventDefault()
              cancel(true)
            }}
          >
            <X />
          </Button>
        </span>
      ) : (
        <button
          ref={trigger}
          type="button"
          // Deliberately not disabled while saving: disabling it here would drop
          // focus on the floor the moment a keyboard user pressed Enter.
          aria-busy={pending || undefined}
          aria-label={t('editable.edit', { label })}
          onClick={startEditing}
          className={cn(
            'inline-flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-start transition-opacity',
            tones.trigger,
            pending && 'opacity-60',
          )}
        >
          <span className={cn('truncate', !value && cn('italic', tones.placeholder))}>
            {value || placeholder || t('editable.empty')}
          </span>
          <Pencil aria-hidden="true" className="size-3.5 shrink-0 opacity-50" />
          {pending ? <span className="sr-only">{t('states.saving')}</span> : null}
        </button>
      )}

      {error ? <InlineError id={errorId}>{error}</InlineError> : null}
    </span>
  )
}
