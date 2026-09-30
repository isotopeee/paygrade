"use client"

import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { BanknoteIcon, LockIcon } from "lucide-react"

import type { PayrollRun } from "@/types"
import { GROUP_LABELS, ROLE_LABELS, RUN_STATUS_LABELS, RUN_STATUS_ORDER, SPECIAL_KIND_LABELS } from "@/lib/constants"
import { formatAmount, formatDate, formatDateTime, formatPeriod } from "@/lib/format"
import { sumBy } from "@/lib/payroll/money"
import { currentOwner } from "@/lib/workflow"
import { createColumns, DataTable, DataTableColumnHeader, type DataTableEmptyState } from "@/components/data-table"
import { RunStatusBadge } from "@/components/status-badge"

const col = createColumns<PayrollRun>()

export function RunsTable({
  runs,
  special = false,
  emptyState,
  toolbar,
}: {
  runs: PayrollRun[]
  special?: boolean
  emptyState?: DataTableEmptyState
  toolbar?: React.ReactNode
}) {
  const router = useRouter()

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("code", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Run" />,
          cell: ({ row }) => (
            <span className="inline-flex items-center gap-1.5 font-mono text-xs">
              {row.original.locked && <LockIcon className="size-3 text-muted-foreground" aria-label="Locked" />}
              {row.original.code}
            </span>
          ),
          footer: () => <span className="text-xs font-normal text-muted-foreground">Totals</span>,
          meta: { label: "Run code" },
        }),
        col.accessor((r) => (r.type === "regular" ? formatPeriod(r.periodStart, r.periodEnd) : r.title), {
          id: "period",
          header: ({ column }) => <DataTableColumnHeader column={column} title={special ? "Payroll" : "Period"} />,
          sortFn: (a, b) => a.original.periodStart.localeCompare(b.original.periodStart),
          cell: ({ row, getValue }) => (
            <div className="min-w-44">
              <div className="font-medium">{getValue()}</div>
              <div className="text-xs text-muted-foreground">
                {row.original.type === "regular" ? row.original.title : formatPeriod(row.original.periodStart, row.original.periodEnd)}
              </div>
            </div>
          ),
          meta: { label: special ? "Payroll" : "Period" },
        }),
        col.accessor((r) => (r.type === "regular" ? "Regular" : "Special"), {
          id: "type",
          header: "Type",
          filterFn: "arrHas",
          meta: { label: "Type" },
        }),
        col.accessor((r) => (r.specialKind ? SPECIAL_KIND_LABELS[r.specialKind] : "Regular"), {
          id: "kind",
          header: "Kind",
          filterFn: "arrHas",
          meta: { label: "Kind" },
        }),
        col.accessor((r) => GROUP_LABELS[r.group], {
          id: "group",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Group" />,
          filterFn: "arrHas",
          meta: { label: "Group" },
        }),
        col.accessor((r) => RUN_STATUS_LABELS[r.status], {
          id: "status",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
          sortFn: (a, b) => RUN_STATUS_ORDER.indexOf(a.original.status) - RUN_STATUS_ORDER.indexOf(b.original.status),
          cell: ({ row }) => {
            const owner = currentOwner(row.original.status)
            return (
              <div className="flex flex-col items-start gap-0.5">
                <RunStatusBadge status={row.original.status} />
                {owner && row.original.status !== "draft" && (
                  <span className="text-[11px] text-muted-foreground">Awaiting {ROLE_LABELS[owner]}</span>
                )}
              </div>
            )
          },
          filterFn: "arrHas",
          meta: { label: "Status" },
        }),
        col.accessor((r) => r.totals.headcount, {
          id: "headcount",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Heads" />,
          cell: ({ row, getValue }) => (row.original.status === "draft" ? row.original.employeeIds.length : getValue()),
          meta: { numeric: true, label: "Headcount" },
        }),
        col.accessor((r) => r.totals.gross, {
          id: "gross",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Gross" />,
          cell: ({ row, getValue }) =>
            row.original.status === "draft" ? <span className="text-muted-foreground">Not computed</span> : formatAmount(getValue()),
          footer: ({ table }) => formatAmount(sumBy(table.getFilteredRowModel().rows, (r) => r.original.totals.gross)),
          meta: { numeric: true, label: "Gross" },
        }),
        col.accessor((r) => r.totals.totalDeductions, {
          id: "deductions",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Deductions" />,
          cell: ({ row, getValue }) => (row.original.status === "draft" ? "" : formatAmount(getValue())),
          footer: ({ table }) => formatAmount(sumBy(table.getFilteredRowModel().rows, (r) => r.original.totals.totalDeductions)),
          meta: { numeric: true, label: "Deductions" },
        }),
        col.accessor((r) => r.totals.net, {
          id: "net",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Net" />,
          cell: ({ row, getValue }) =>
            row.original.status === "draft" ? "" : <span className="font-medium">{formatAmount(getValue())}</span>,
          footer: ({ table }) => formatAmount(sumBy(table.getFilteredRowModel().rows, (r) => r.original.totals.net)),
          meta: { numeric: true, label: "Net" },
        }),
        col.accessor("payDate", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Pay date" />,
          cell: ({ getValue }) => <span className="tabular-nums">{formatDate(getValue())}</span>,
          meta: { label: "Pay date" },
        }),
        col.accessor((r) => r.history.at(-1)?.at ?? r.createdAt, {
          id: "updated",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Last action" />,
          cell: ({ row, getValue }) => (
            <div className="text-xs">
              <div className="tabular-nums">{formatDateTime(getValue())}</div>
              <div className="text-muted-foreground">{row.original.history.at(-1)?.by}</div>
            </div>
          ),
          meta: { label: "Last action" },
        }),
      ]),
    [special]
  )

  const statusOptions = RUN_STATUS_ORDER.map((s) => ({ label: RUN_STATUS_LABELS[s], value: RUN_STATUS_LABELS[s] }))
  const kindOptions = Object.values(SPECIAL_KIND_LABELS).map((l) => ({ label: l, value: l }))

  return (
    <DataTable
      columns={columns}
      data={runs}
      getRowId={(r) => r.id}
      searchPlaceholder={special ? "Search special payroll" : "Search runs by code or period"}
      filters={[
        { columnId: "status", title: "Status", options: statusOptions },
        ...(special
          ? [{ columnId: "kind", title: "Kind", options: kindOptions }]
          : [
              { columnId: "group", title: "Group", options: [{ label: "Plantilla", value: "Plantilla" }, { label: "JO/COS", value: "JO/COS" }] },
              { columnId: "type", title: "Type", options: [{ label: "Regular", value: "Regular" }, { label: "Special", value: "Special" }] },
            ]),
      ]}
      initialSorting={[{ id: "payDate", desc: true }]}
      initialVisibility={{ type: !special, kind: special, deductions: false, updated: false, group: !special }}
      onRowClick={(r) => router.push(r.type === "special" ? `/special-payroll/${r.id}` : `/payroll/${r.id}`)}
      rowLabel={(r) => `Open ${r.code}`}
      toolbar={toolbar}
      showFooter
      emptyState={
        emptyState ?? {
          icon: <BanknoteIcon />,
          title: "No payroll runs yet",
          description: "Create the first run for the current period.",
        }
      }
    />
  )
}
