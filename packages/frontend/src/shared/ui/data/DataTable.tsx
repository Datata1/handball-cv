import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
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
  /** Turns the header into a button. Needs the table's `sort` prop to do anything. */
  sortable?: boolean
}

/**
 * Which column the rows are ordered by. The table only reports it — reordering
 * stays with the caller, who owns the rows.
 */
export type TableSort = {
  columnId: string
  direction: 'ascending' | 'descending'
  onSort: (columnId: string) => void
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
  sort,
  empty,
  className,
}: {
  /** Required: a table with no accessible name is an axe violation. */
  caption: ReactNode
  captionHidden?: boolean
  columns: Column<Row>[]
  rows: Row[]
  getRowId: (row: Row) => string
  sort?: TableSort
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
          {columns.map((column) => {
            const sortable = column.sortable === true && sort !== undefined
            const sorted = sortable && sort.columnId === column.id

            return (
              <TableHead
                key={column.id}
                className={cn(column.numeric && 'text-right')}
                scope="col"
                // The state belongs on the header cell, not on the button:
                // `aria-sort` is only defined on a `columnheader`.
                aria-sort={sortable ? (sorted ? sort.direction : 'none') : undefined}
              >
                {sortable ? (
                  <button
                    type="button"
                    onClick={() => sort.onSort(column.id)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      !sorted && 'text-muted-foreground',
                    )}
                  >
                    {column.header}
                    <SortIcon direction={sorted ? sort.direction : null} />
                  </button>
                ) : (
                  column.header
                )}
              </TableHead>
            )
          })}
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

/** Decoration: the sorted state is announced by the header's `aria-sort`. */
function SortIcon({ direction }: { direction: TableSort['direction'] | null }) {
  const Icon =
    direction === 'ascending'
      ? ArrowUp
      : direction === 'descending'
        ? ArrowDown
        : ArrowUpDown

  return <Icon aria-hidden="true" className="size-3.5 shrink-0" />
}
