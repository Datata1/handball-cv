import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * "There is nothing here, and that is a fact about the data" — as opposed to
 * `ErrorState`, which means the client never found out.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  /** A lucide icon element; labelled by the title, so it is hidden from AT. */
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn(
        'items-center gap-3 border-dashed px-6 py-10 text-center shadow-none',
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-8">
          {icon}
        </span>
      ) : null}

      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="mx-auto max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {action}
    </Card>
  )
}
