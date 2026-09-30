"use client"

import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react"
import type { RowData } from "@tanstack/react-table"

import { formatNumber } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

import type { AppTable } from "./features"

const PAGE_SIZES = [10, 20, 50, 100]

export function DataTablePagination<TData extends RowData>({
  table,
  selectable,
  pageIndex,
  pageSize,
  selected,
}: {
  table: AppTable<TData>
  selectable: boolean
  pageIndex: number
  pageSize: number
  selected: number
}) {
  const filtered = table.getFilteredRowModel().rows.length
  const pageCount = Math.max(1, table.getPageCount())
  const from = filtered === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min(filtered, (pageIndex + 1) * pageSize)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
      <div className="tabular-nums">
        {selectable && selected > 0 ? (
          <span>
            {formatNumber(selected)} of {formatNumber(filtered)} selected
          </span>
        ) : (
          <span>
            {formatNumber(from)} to {formatNumber(to)} of {formatNumber(filtered)} rows
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="rows-per-page" className="hidden sm:inline">
            Rows per page
          </label>
          <NativeSelect
            id="rows-per-page"
            size="sm"
            value={String(pageSize)}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="w-18"
          >
            {PAGE_SIZES.map((size) => (
              <NativeSelectOption key={size} value={size}>
                {size}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <span className="tabular-nums">
          Page {pageIndex + 1} of {pageCount}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden lg:inline-flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="First page"
          >
            <ChevronsLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden lg:inline-flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="Last page"
          >
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
