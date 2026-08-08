import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The content column: one max width and one vertical rhythm for every route,
 * so a page is a `PageHeader` followed by `Section`s and nothing has to pick
 * its own padding.
 */
export function Page({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8',
        className,
      )}
    >
      {children}
    </div>
  )
}
