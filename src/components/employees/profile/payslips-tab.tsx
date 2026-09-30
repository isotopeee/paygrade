"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { ReceiptTextIcon } from "lucide-react"

import type { PayrollLine, PayrollRun } from "@/types"
import { formatDate, formatPeriod } from "@/lib/format"
import { payslipsFor } from "@/lib/selectors"
import { useDataStore } from "@/stores/data-store"
import { createColumns, DataTable, DataTableColumnHeader } from "@/components/data-table"
import { Money } from "@/components/money"
import { RunStatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"

interface PayslipRow {
  run: PayrollRun
  line: PayrollLine
}

const col = createColumns<PayslipRow>()

const columns = col.columns([
  col.accessor((r) => r.run.payDate, {
    id: "payDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Pay date" />,
    cell: ({ getValue }) => <span className="whitespace-nowrap tabular-nums">{formatDate(getValue())}</span>,
    meta: { label: "Pay date" },
  }),
  col.accessor((r) => (r.run.type === "regular" ? formatPeriod(r.run.periodStart, r.run.periodEnd) : r.run.title), {
    id: "period",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Period" />,
    cell: ({ row }) => (
      <div className="flex min-w-40 flex-col">
        <span>{row.original.run.type === "regular" ? formatPeriod(row.original.run.periodStart, row.original.run.periodEnd) : row.original.run.title}</span>
        <span className="font-mono text-xs text-muted-foreground">{row.original.run.code}</span>
      </div>
    ),
    meta: { label: "Period" },
  }),
  col.accessor((r) => r.run.type, {
    id: "type",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Run type" />,
    cell: ({ getValue }) => <Badge variant="outline">{getValue() === "regular" ? "Regular" : "Special"}</Badge>,
    meta: { label: "Run type" },
  }),
  col.accessor((r) => r.line.gross, {
    id: "gross",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Gross" />,
    cell: ({ getValue }) => <Money value={getValue()} plain />,
    meta: { label: "Gross", numeric: true },
  }),
  col.accessor((r) => r.line.totalDeductions, {
    id: "deductions",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Deductions" />,
    cell: ({ getValue }) => <Money value={getValue()} plain muteZero />,
    meta: { label: "Deductions", numeric: true },
  }),
  col.accessor((r) => r.line.net, {
    id: "net",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Net pay" />,
    cell: ({ getValue }) => <Money value={getValue()} plain className="font-medium" />,
    meta: { label: "Net pay", numeric: true },
  }),
  col.accessor((r) => r.run.status, {
    id: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ getValue }) => <RunStatusBadge status={getValue()} />,
    meta: { label: "Status" },
  }),
])

export function PayslipsTab({ employeeId }: { employeeId: string }) {
  const router = useRouter()
  const runs = useDataStore((s) => s.runs)
  const rows = useMemo(() => payslipsFor(runs, employeeId), [runs, employeeId])

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.run.id}
      initialSorting={[{ id: "payDate", desc: true }]}
      pageSize={12}
      maxHeightClassName="max-h-none"
      onRowClick={(r) => router.push(`/payslips/${r.run.id}/${employeeId}`)}
      rowLabel={(r) => `Open payslip for ${r.run.code}`}
      emptyState={{
        icon: <ReceiptTextIcon />,
        title: "No payslips yet",
        description: "Payslips appear once this employee is included in a computed payroll run.",
      }}
    />
  )
}
