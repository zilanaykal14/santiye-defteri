import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button, Input, Table, TBody, TD, TFoot, TH, THead, TR } from '@/components/ui'
import { cn } from '@/lib/utils'

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  searchPlaceholder?: string
  initialSorting?: SortingState
  pageSize?: number
  footer?: React.ReactNode
  toolbar?: React.ReactNode
  empty?: React.ReactNode
}

/** TanStack Table tabanlı genel tablo: sıralama, arama, sayfalama */
export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = 'Ara…',
  initialSorting = [],
  pageSize = 15,
  footer,
  toolbar,
  empty,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [globalFilter, setGlobalFilter] = React.useState('')
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })
  const rows = table.getRowModel().rows
  const pageCount = table.getPageCount()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
          />
        </div>
        {toolbar && <div className="flex flex-wrap gap-2 sm:ml-auto">{toolbar}</div>}
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <THead>
            {table.getHeaderGroups().map((hg) => (
              <TR key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted()
                  const meta = h.column.columnDef.meta as { align?: 'right' } | undefined
                  return (
                    <TH key={h.id} className={cn(meta?.align === 'right' && 'text-right')}>
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          className={cn('inline-flex items-center gap-1 hover:text-foreground cursor-pointer', meta?.align === 'right' && 'flex-row-reverse')}
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === 'asc' ? <ArrowUp className="size-3" /> : sorted === 'desc' ? <ArrowDown className="size-3" /> : null}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TH>
                  )
                })}
              </TR>
            ))}
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                  {empty ?? 'Kayıt bulunamadı.'}
                </TD>
              </TR>
            ) : (
              rows.map((r) => (
                <TR key={r.id}>
                  {r.getVisibleCells().map((c) => {
                    const meta = c.column.columnDef.meta as { align?: 'right' } | undefined
                    return (
                      <TD key={c.id} className={cn(meta?.align === 'right' && 'text-right')}>
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </TD>
                    )
                  })}
                </TR>
              ))
            )}
          </TBody>
          {footer && <TFoot>{footer}</TFoot>}
        </Table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {table.getFilteredRowModel().rows.length} kayıt · Sayfa {table.getState().pagination.pageIndex + 1}/{pageCount}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Önceki">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Sonraki">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
