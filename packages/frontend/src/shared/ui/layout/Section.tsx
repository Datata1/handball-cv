import { type ReactNode, useId } from 'react'

import { cn } from '@/lib/utils'

/**
 * A titled block of a page, rendered as a landmark labelled by its own
 * heading — so the report's sections show up in a screen reader's region list.
 *
 * `headingLevel` exists because the report shell nests sections one level
 * deeper than a plain page does, and a skipped level is an axe violation.
 */
export function Section({
  title,
  description,
  actions,
  headingLevel = 2,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  headingLevel?: 2 | 3
  children: ReactNode
  className?: string
}) {
  const headingId = useId()
  const Heading = headingLevel === 2 ? 'h2' : 'h3'

  return (
    <section aria-labelledby={headingId} className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 space-y-1">
          <Heading
            id={headingId}
            className={cn(
              'font-semibold tracking-tight',
              headingLevel === 2 ? 'text-lg' : 'text-base',
            )}
          >
            {title}
          </Heading>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {children}
    </section>
  )
}
