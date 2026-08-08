import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * A field-level failure, sitting under the control it belongs to. Give it an
 * `id` and point the control's `aria-describedby` at it.
 *
 * A `span`, not a `p`: an editable field can sit inside a heading or a
 * paragraph, and a `p` nested in either is closed early by the parser.
 */
export function InlineError({
  id,
  children,
  className,
}: {
  id?: string
  children: ReactNode
  className?: string
}) {
  return (
    <span
      id={id}
      role="alert"
      className={cn('flex items-start gap-1.5 text-sm text-destructive', className)}
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </span>
  )
}
