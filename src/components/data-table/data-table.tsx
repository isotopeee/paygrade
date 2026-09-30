"use client"

import * as React from "react"
import { SearchIcon, SearchXIcon, XIcon } from "lucide-react"
import {
  useTable,
  type ColumnFiltersState,
  type RowData,
  type SortingState,
  type ColumnVisibilityState,
} from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { DataTableFacetedFilter, type FilterOption } from "./faceted-filter"
import {
  createColumns,
  dataTableFeatures,
  type AppRow,
  type DataTableColumnMeta,
  type DataTableColumns,
} from "./features"
import { DataTablePagination } from "./pagination"
import { DataTableViewOptions } from "./view-options"

export interface DataTableFilter {
  columnId: string
  title: string
  options: FilterOption[]
}

export interface DataTableEmptyState {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export interface DataTableProps<TData extends RowData> {
  columns: DataTableColumns<TData>
  data: TData[]
  getRowId: (row: TData) => string
  /** Placeholder for the global search box. Omit to hide search. */
  searchPlaceholder?: string
  filters?: DataTableFilter[]
  /** Extra toolbar content on the right, before the column toggle. */
  toolbar?: React.ReactNode
  onRowClick?: (row: TData) => void
  /** Accessible label for a clickable row. */
  rowLabel?: (row: TData) => string
  enableSelection?: boolean
  selectionActions?: (rows: TData[], clear: () => void) => React.ReactNode
  loading?: boolean
  /** Show a short skeleton on first mount to mimic a network fetch. Defaults to true. */
  simulateLoading?: boolean
  emptyState?: DataTableEmptyState
  initialSorting?: SortingState
  initialVisibility?: ColumnVisibilityState
  initialFilters?: ColumnFiltersState
  pageSize?: number
  /** Show the column footer row (for totals). */
  showFooter?: boolean
  /** Tailwind max-height class for the scroll area that holds the sticky header. */
  maxHeightClassName?: string
  /** Highlight a row (for example the one open in a side sheet). */
  activeRowId?: string
  rowClassName?: (row: TData) => string | undefined
  className?: string
  /** Compact density for wide registers. */
  dense?: boolean
  hidePagination?: boolean
}

function alignClass(meta: DataTableColumnMeta | undefined) {
  if (meta?.numeric || meta?.align === "right") return "text-right"
  if (meta?.align === "center") return "text-center"
  return undefined
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  searchPlaceholder,
  filters,
  toolbar,
  onRowClick,
  rowLabel,
  enableSelection = false,
  selectionActions,
  loading = false,
  simulateLoading = true,
  emptyState,
  initialSorting,
  initialVisibility,
  initialFilters,
  pageSize = 20,
  showFooter = false,
  maxHeightClassName = "max-h-[calc(100svh-17rem)]",
  activeRowId,
  rowClassName,
  className,
  dense = false,
  hidePagination = false,
}: DataTableProps<TData>) {
  const allColumns = React.useMemo(() => {
    if (!enableSelection) return columns
    const helper = createColumns<TData>()
    const select = helper.display({
      id: "select",
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => {
        const all = table.getIsAllPageRowsSelected()
        const some = table.getIsSomePageRowsSelected() && !all
        return (
          <Checkbox
            checked={all}
            indeterminate={some}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all rows on this page"
          />
        )
      },
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select row"
        />
      ),
      meta: { cellClassName: "w-8", headerClassName: "w-8" },
    })
    return [select, ...columns] as DataTableColumns<TData>
  }, [columns, enableSelection])

  const table = useTable({
    features: dataTableFeatures,
    columns: allColumns,
    data,
    getRowId: (row: TData) => getRowId(row),
    globalFilterFn: "includesString",
    initialState: {
      sorting: initialSorting ?? [],
      columnVisibility: initialVisibility ?? {},
      columnFilters: initialFilters ?? [],
      pagination: { pageIndex: 0, pageSize },
      globalFilter: "",
      rowSelection: {},
    },
  })

  const [warming, setWarming] = React.useState(simulateLoading)
  React.useEffect(() => {
    if (!simulateLoading) return
    const timer = window.setTimeout(() => setWarming(false), 350)
    return () => window.clearTimeout(timer)
  }, [simulateLoading])
  const showLoading = loading || warming

  const globalFilter = String(table.state.globalFilter ?? "")
  const isFiltered = globalFilter.length > 0 || table.state.columnFilters.length > 0
  const rows = hidePagination ? table.getPrePaginatedRowModel().rows : table.getRowModel().rows
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original)
  const visibleColumnCount = table.getVisibleLeafColumns().length
  const clearSelection = () => table.resetRowSelection(true)

  const handleRowKey = (event: React.KeyboardEvent, row: AppRow<TData>) => {
    if (!onRowClick) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onRowClick(row.original)
    }
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      {(
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {searchPlaceholder && (
              <InputGroup className="h-8 w-full sm:w-64">
                <InputGroupAddon>
                  <SearchIcon aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  value={globalFilter}
                  onChange={(e) => table.setGlobalFilter(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                />
              </InputGroup>
            )}
            {filters?.map((f) => {
              const column = table.getColumn(f.columnId)
              if (!column) return null
              return <DataTableFacetedFilter key={f.columnId} column={column} title={f.title} options={f.options} />
            })}
            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  table.resetColumnFilters(true)
                  table.setGlobalFilter("")
                }}
              >
                Reset
                <XIcon aria-hidden />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {toolbar}
            <DataTableViewOptions table={table} />
          </div>
        </div>
      )}

      {enableSelection && selectedRows.length > 0 && selectionActions && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-sm"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="font-medium tabular-nums">{selectedRows.length} selected</span>
          <div className="mx-1 h-4 w-px bg-border" />
          {selectionActions(selectedRows, clearSelection)}
          <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={clearSelection}>
            Clear selection
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <Table containerClassName={cn("overflow-auto", maxHeightClassName)} className={cn(dense && "text-[0.8125rem]")}>
          <TableHeader className="sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn("h-9 bg-background", alignClass(meta), meta?.headerClassName)}
                      aria-sort={
                        header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {showLoading ? (
              Array.from({ length: 8 }, (_, i) => (
                <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                  {Array.from({ length: visibleColumnCount }, (_, j) => (
                    <TableCell key={j} className={dense ? "py-1.5" : undefined}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumnCount} className="p-0">
                  {isFiltered || data.length > 0 ? (
                    <Empty className="py-12">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <SearchXIcon />
                        </EmptyMedia>
                        <EmptyTitle>No matching records</EmptyTitle>
                        <EmptyDescription>Try a different search term or clear the filters.</EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            table.resetColumnFilters(true)
                            table.setGlobalFilter("")
                          }}
                        >
                          Clear filters
                        </Button>
                      </EmptyContent>
                    </Empty>
                  ) : (
                    <Empty className="py-12">
                      <EmptyHeader>
                        {emptyState?.icon && <EmptyMedia variant="icon">{emptyState.icon}</EmptyMedia>}
                        <EmptyTitle>{emptyState?.title ?? "No records yet"}</EmptyTitle>
                        {emptyState?.description && <EmptyDescription>{emptyState.description}</EmptyDescription>}
                      </EmptyHeader>
                      {emptyState?.action && <EmptyContent>{emptyState.action}</EmptyContent>}
                    </Empty>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const id = row.id
                return (
                  <TableRow
                    key={id}
                    data-state={row.getIsSelected() || id === activeRowId ? "selected" : undefined}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    onKeyDown={onRowClick ? (e) => handleRowKey(e, row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-label={onRowClick && rowLabel ? rowLabel(row.original) : undefined}
                    className={cn(
                      onRowClick &&
                        "cursor-pointer focus-visible:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      rowClassName?.(row.original)
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            dense ? "px-2 py-1.5" : "px-2 py-2",
                            alignClass(meta),
                            meta?.numeric && "tabular-nums",
                            meta?.cellClassName
                          )}
                        >
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            )}
          </TableBody>
          {showFooter && !showLoading && rows.length > 0 && (
            <TableFooter className="sticky bottom-0 z-10 bg-muted shadow-[inset_0_1px_0_var(--border)]">
              {table.getFooterGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => {
                    const meta = header.column.columnDef.meta
                    return (
                      <TableCell
                        key={header.id}
                        className={cn(
                          dense ? "px-2 py-1.5" : "px-2 py-2",
                          "font-medium",
                          alignClass(meta),
                          meta?.numeric && "tabular-nums"
                        )}
                      >
                        {header.isPlaceholder ? null : <table.FlexRender footer={header} />}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableFooter>
          )}
        </Table>
      </div>

      {!hidePagination && <DataTablePagination
          table={table}
          selectable={enableSelection}
          pageIndex={table.state.pagination.pageIndex}
          pageSize={table.state.pagination.pageSize}
          selected={selectedRows.length}
        />}
    </div>
  )
}
