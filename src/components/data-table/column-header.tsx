"use client"

import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react"
import type { CellData, RowData } from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import type { AppColumn } from "./features"

export function DataTableColumnHeader<TData extends RowData, TValue extends CellData>({
  column,
  title,
  className,
}: {
  column: AppColumn<TData, TValue>
  title: string
  className?: string
}) {
  const meta = column.columnDef.meta
  const alignRight = meta?.numeric || meta?.align === "right"

  if (!column.getCanSort()) {
    return <span className={cn("text-xs font-medium text-muted-foreground", className)}>{title}</span>
  }

  const sorted = column.getIsSorted()
  const label = sorted === "asc" ? "sorted ascending" : sorted === "desc" ? "sorted descending" : "not sorted"

  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={column.getToggleSortingHandler()}
      aria-label={`${title}, ${label}. Activate to change sorting.`}
      className={cn(
        "h-7 gap-1 px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground data-[sorted=true]:text-foreground",
        alignRight ? "-mr-1.5 ml-auto flex-row-reverse" : "-ml-1.5",
        className
      )}
      data-sorted={sorted !== false}
    >
      <span>{title}</span>
      {sorted === "asc" ? (
        <ArrowUpIcon aria-hidden />
      ) : sorted === "desc" ? (
        <ArrowDownIcon aria-hidden />
      ) : (
        <ChevronsUpDownIcon aria-hidden className="opacity-50" />
      )}
    </Button>
  )
}
