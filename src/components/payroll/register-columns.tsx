"use client"

import { TriangleAlertIcon } from "lucide-react"

import type { Department, PayrollLine } from "@/types"
import { GROUP_LABELS } from "@/lib/constants"
import { formatAmount } from "@/lib/format"
import { sumBy } from "@/lib/payroll/money"
import { createColumns, DataTableColumnHeader, type DataTableColumns } from "@/components/data-table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const col = createColumns<PayrollLine>()

type NumericKey = {
  [K in keyof PayrollLine]: PayrollLine[K] extends number ? K : never
}[keyof PayrollLine]

function amountColumn(key: NumericKey, title: string, options: { emphasize?: boolean; hidden?: boolean } = {}) {
  return col.accessor(key, {
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
    footer: ({ table }) => formatAmount(sumBy(table.getFilteredRowModel().rows, (r) => r.original[key])),
    meta: { numeric: true, label: title },
  })
}

function identityColumns(departments: Department[]) {
  return [
    col.accessor("employeeNo", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Emp. No." />,
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
      footer: () => <span className="text-xs font-normal text-muted-foreground">Totals</span>,
      meta: { label: "Employee No.", cellClassName: "w-24" },
    }),
    col.accessor("employeeName", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => (
        <div className="max-w-56 min-w-40">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{row.original.employeeName}</span>
            {row.original.flags.length > 0 && (
              <Tooltip>
                <TooltipTrigger
                  render={<span className="inline-flex shrink-0" tabIndex={0} aria-label={`${row.original.flags.length} computation notes`} />}
                >
                  <TriangleAlertIcon className="size-3.5 text-muted-foreground" aria-hidden />
                </TooltipTrigger>
                <TooltipContent className="max-w-72">
                  <ul className="space-y-0.5">
                    {row.original.flags.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">{row.original.positionTitle}</div>
        </div>
      ),
      footer: ({ table }) => (
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          {table.getFilteredRowModel().rows.length} employees
        </span>
      ),
      meta: { label: "Employee" },
    }),
    col.accessor((row) => departments.find((d) => d.id === row.departmentId)?.name ?? row.departmentId, {
      id: "department",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
      filterFn: "arrHas",
      meta: { label: "Department" },
    }),
    col.accessor((row) => (row.flags.length > 0 ? "With notes" : "No notes"), {
      id: "exceptions",
      header: "Notes",
      filterFn: "arrHas",
      enableSorting: false,
      meta: { label: "Computation notes" },
    }),
    col.accessor((row) => GROUP_LABELS[row.group], {
      id: "group",
      header: "Group",
      filterFn: "arrHas",
      meta: { label: "Group" },
    }),
  ]
}

export function regularRegisterColumns(departments: Department[]): DataTableColumns<PayrollLine> {
  return col.columns([
    ...identityColumns(departments),
    amountColumn("monthlyRate", "Monthly rate"),
    amountColumn("basic", "Basic"),
    amountColumn("pera", "PERA"),
    amountColumn("allowancesTotal", "Allowances"),
    amountColumn("overtime", "Overtime"),
    amountColumn("nightDiff", "Night diff"),
    amountColumn("gross", "Gross", { emphasize: true }),
    amountColumn("gsis", "GSIS"),
    amountColumn("philhealth", "PhilHealth"),
    amountColumn("pagibig", "Pag-IBIG"),
    amountColumn("withholdingTax", "W/Tax"),
    amountColumn("loansTotal", "Loans"),
    amountColumn("otherDeductionsTotal", "Other ded."),
    amountColumn("totalDeductions", "Total ded."),
    amountColumn("net", "Net pay", { emphasize: true }),
    amountColumn("gsisGovernment", "GSIS (gov)"),
    amountColumn("philhealthGovernment", "PhilHealth (gov)"),
    amountColumn("pagibigGovernment", "Pag-IBIG (gov)"),
  ])
}

/** Special payroll: one column per earning code found in the run. */
export function specialRegisterColumns(
  departments: Department[],
  earnings: { code: string; label: string }[]
): DataTableColumns<PayrollLine> {
  const earningColumns = earnings.map((e) =>
    col.accessor((row) => row.allowances.find((a) => a.code === e.code)?.amount ?? 0, {
      id: `earn-${e.code}`,
      header: ({ column }) => <DataTableColumnHeader column={column} title={e.label} />,
      cell: ({ getValue }) => formatAmount(getValue()),
      footer: ({ table }) =>
        formatAmount(
          sumBy(table.getFilteredRowModel().rows, (r) => r.original.allowances.find((a) => a.code === e.code)?.amount ?? 0)
        ),
      meta: { numeric: true, label: e.label },
    })
  )
  return col.columns([
    ...identityColumns(departments),
    amountColumn("monthlyRate", "Monthly basic"),
    ...earningColumns,
    col.accessor((row) => sumBy(row.otherEarnings, (e) => e.amount), {
      id: "otherEarnings",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Other earnings" />,
      cell: ({ getValue }) => formatAmount(getValue()),
      footer: ({ table }) =>
        formatAmount(sumBy(table.getFilteredRowModel().rows, (r) => sumBy(r.original.otherEarnings, (e) => e.amount))),
      meta: { numeric: true, label: "Other earnings" },
    }),
    amountColumn("gross", "Gross", { emphasize: true }),
    amountColumn("totalDeductions", "Deductions"),
    amountColumn("net", "Net pay", { emphasize: true }),
  ])
}
