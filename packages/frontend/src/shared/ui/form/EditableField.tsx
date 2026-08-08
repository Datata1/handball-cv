import { Check, Pencil, X } from 'lucide-react'
import {
  type FocusEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
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

/** Room for the caret and a couple of characters of headroom. */
const MIN_COLUMNS = 12

/**
 * A value that turns into an input when you click it.
 *
 * **Saving is always deliberate**: Enter or the confirm button, nothing else.
 * Escape, the cancel button and moving focus out of the field all discard the
 * draft. The legacy component committed on blur, so clicking anywhere saved an
 * edit the user may have been in the middle of abandoning — and it needed a
 * `cancelledRef` to stop its own cancel button from triggering that save.
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

  const restoreFocus = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const group = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (editing) {
      input.current?.focus()
      // Selected, not just focused: the common edit is a full replacement.
      input.current?.select()
      return
    }

    // Only the deliberate exits (Enter, Escape, the two buttons) ask for focus
    // back. Focus leaving the field means the user already sent it somewhere.
    if (!restoreFocus.current) return
    restoreFocus.current = false
    trigger.current?.focus()
  }, [editing])

  function startEditing() {
    setDraft(value)
    setEditing(true)
  }

  function commit(returnFocus: boolean) {
    restoreFocus.current = returnFocus
    setEditing(false)

    const next = draft.trim()
    if (next !== value) onSave(next)
  }

  function cancel(returnFocus: boolean) {
    restoreFocus.current = returnFocus
    setDraft(value)
    setEditing(false)
  }

  // Every control in the editor shares this, so that tabbing from the input to
  // the confirm button does not read as leaving — which would unmount the
  // button before it could be pressed.
  function discardOnLeave(event: FocusEvent) {
    if (group.current?.contains(event.relatedTarget)) return

    cancel(false)
  }

  return (
    <span className={cn('inline-flex flex-col items-start gap-1', className)}>
      {editing ? (
        <span ref={group} className="inline-flex items-center gap-1">
          <Label htmlFor={fieldId} className="sr-only">
            {label}
          </Label>

          <Input
            ref={input}
            id={fieldId}
            value={draft}
            // Grows with the draft, so opening the editor does not shove the
            // rest of the row sideways.
            size={Math.max(draft.length + 1, MIN_COLUMNS)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={discardOnLeave}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== 'Escape') return

              // Cancelling the keydown suppresses the keypress that follows.
              // Without it the key lands on the trigger we are about to focus,
              // and Enter on a button means "press it" — reopening the editor.
              event.preventDefault()

              if (event.key === 'Enter') commit(true)
              else cancel(true)
            }}
            className={cn('h-8 w-auto max-w-full text-sm', tones.input)}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('actions.save')}
            onBlur={discardOnLeave}
            onClick={() => commit(true)}
          >
            <Check />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('actions.cancel')}
            onBlur={discardOnLeave}
            onClick={() => cancel(true)}
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
