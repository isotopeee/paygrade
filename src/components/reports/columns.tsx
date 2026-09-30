"use client"

import type { ColumnHelper, RowData } from "@tanstack/react-table"

import { formatAmount } from "@/lib/format"
import { DataTableColumnHeader, type AppFeatures } from "@/components/data-table"

type NumericKey<T> = {
  [K in keyof T]: T[K] extends number ? K : never
}[keyof T] &
  string

/** Right-aligned peso column (no currency sign) with a filtered-rows total in the footer. */
export function amountColumn<T extends RowData>(
  col: ColumnHelper<AppFeatures, T>,
  key: NumericKey<T>,
  title: string,
  options: { emphasize?: boolean; total?: boolean } = {}
) {
  const pick = (row: T) => row[key] as number
  return col.accessor((row) => pick(row), {
    id: key,
    header: ({ column }) => <DataTableColumnHeader column={column} title={title} />,
    cell: ({ getValue }) => {
      const v = getValue()
      return (
        <span className={v === 0 ? "text-muted-foreground/50" : options.emphasize ? "font-semibold" : undefined}>
          {formatAmount(v)}
        </span>
      )
    },
    footer:
      options.total === false
        ? undefined
        : ({ table }) => {
            let total = 0
            for (const r of table.getFilteredRowModel().rows) total += pick(r.original)
            return formatAmount(total)
          },
    meta: { numeric: true, label: title },
  })
}

export function FooterLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-normal text-muted-foreground tabular-nums">{children}</span>
}
