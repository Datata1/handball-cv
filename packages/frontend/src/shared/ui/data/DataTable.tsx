import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type Column<Row> = {
  id: string
  header: ReactNode
  cell: (row: Row) => ReactNode
  /** Numbers read better right-aligned; they also get tabular figures. */
  numeric?: boolean
}

/**
 * A table from column definitions, so a feature describes its columns once
 * instead of keeping `<th>` and `<td>` in sync by hand.
 */
export function DataTable<Row>({
  caption,
  captionHidden = false,
  columns,
  rows,
  getRowId,
  empty,
  className,
}: {
  /** Required: a table with no accessible name is an axe violation. */
  caption: ReactNode
  captionHidden?: boolean
  columns: Column<Row>[]
  rows: Row[]
  getRowId: (row: Row) => string
  /** Rendered in place of the body when there are no rows. */
  empty?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <Table className={className}>
      <TableCaption className={cn(captionHidden && 'sr-only')}>{caption}</TableCaption>

      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.id}
              className={cn(column.numeric && 'text-right')}
              scope="col"
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="py-8 text-center text-muted-foreground"
            >
              {empty ?? t('states.empty')}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={getRowId(row)}>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(column.numeric && 'text-right tabular-nums')}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
