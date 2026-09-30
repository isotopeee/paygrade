"use client"

import { useMemo, useState } from "react"

import { formatCurrency, formatDate } from "@/lib/format"
import { buildRegister, reportableRuns, type RegisterRow, type ReportMeta } from "@/lib/reports"
import { runLabel, useDataStore } from "@/stores/data-store"
import { createColumns, DataTable, DataTableColumnHeader } from "@/components/data-table"
import { StatCard } from "@/components/stat-card"
import { RunStatusBadge } from "@/components/status-badge"

import { amountColumn, FooterLabel } from "./columns"
import { NoRunsState } from "./no-data"
import { FilterSelect, ReportLayout } from "./report-layout"

const col = createColumns<RegisterRow>()

function buildColumns() {
  return col.columns([
    col.accessor("employeeNo", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Emp. No." />,
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
      footer: () => <FooterLabel>Totals</FooterLabel>,
      meta: { label: "Employee No." },
    }),
    col.accessor("name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => (
        <div className="max-w-52 min-w-36">
          <div className="truncate font-medium">{row.original.name}</div>
          <div className="truncate text-xs text-muted-foreground">{row.original.position}</div>
        </div>
      ),
      footer: ({ table }) => <FooterLabel>{table.getFilteredRowModel().rows.length} employees</FooterLabel>,
      meta: { label: "Employee" },
    }),
    col.accessor("department", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
      filterFn: "arrHas",
      meta: { label: "Department" },
    }),
    amountColumn(col, "basic", "Basic"),
    amountColumn(col, "pera", "PERA"),
    amountColumn(col, "allowances", "Allowances"),
    amountColumn(col, "overtime", "OT and ND"),
    amountColumn(col, "gross", "Gross", { emphasize: true }),
    amountColumn(col, "gsis", "GSIS PS"),
    amountColumn(col, "philhealth", "PhilHealth PS"),
    amountColumn(col, "pagibig", "Pag-IBIG PS"),
    amountColumn(col, "tax", "W/Tax"),
    amountColumn(col, "loans", "Loans"),
    amountColumn(col, "other", "Other"),
    amountColumn(col, "totalDeductions", "Total deductions"),
    amountColumn(col, "net", "Net", { emphasize: true }),
    amountColumn(col, "gsisGovernment", "GSIS gov"),
    amountColumn(col, "ecc", "ECC"),
    amountColumn(col, "philhealthGovernment", "PhilHealth gov"),
    amountColumn(col, "pagibigGovernment", "Pag-IBIG gov"),
    amountColumn(col, "psCost", "Total PS cost", { emphasize: true }),
  ])
}

export function PayrollRegisterReport({ meta }: { meta: ReportMeta }) {
  const runs = useDataStore((s) => s.runs)
  const departments = useDataStore((s) => s.departments)
  const options = useMemo(() => reportableRuns(runs), [runs])
  const [runId, setRunId] = useState(() => options[0]?.id ?? "")
  const run = options.find((r) => r.id === runId) ?? options[0]
  const rows = useMemo(() => (run ? buildRegister(run, departments) : []), [run, departments])
  const columns = useMemo(() => buildColumns(), [])
  const deptOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.department))).sort().map((d) => ({ label: d, value: d })),
    [rows]
  )
  const totals = useMemo(() => {
    let gross = 0
    let shares = 0
    let net = 0
    for (const r of rows) {
      gross += r.gross
      shares += r.employerShares
      net += r.net
    }
    return { gross, shares, net, ps: gross + shares }
  }, [rows])

  return (
    <ReportLayout
      meta={meta}
      fileStem={`payroll-register-${run?.code ?? "none"}`}
      rows={rows.length}
      exportDisabled={!run}
      filters={
        <>
          <FilterSelect
            id="pr-run"
            label="Payroll run"
            value={run?.id ?? ""}
            onChange={setRunId}
            options={options.map((r) => ({ value: r.id, label: runLabel(r) }))}
            className="w-[28rem] max-w-full"
          />
          {run && (
            <div className="flex items-center gap-2 pb-1 text-xs text-muted-foreground">
              <RunStatusBadge status={run.status} />
              Pay date {formatDate(run.payDate)}
            </div>
          )}
        </>
      }
    >
      {!run ? (
        <NoRunsState />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Gross pay" value={formatCurrency(totals.gross)} hint={`${rows.length} employees`} />
            <StatCard label="Net pay" value={formatCurrency(totals.net)} />
            <StatCard label="Government shares" value={formatCurrency(totals.shares)} hint="GSIS, ECC, PhilHealth, Pag-IBIG" />
            <StatCard label="Total PS cost" value={formatCurrency(totals.ps)} hint="Gross plus government shares" />
          </div>
          <DataTable
            key={run.id}
            columns={columns}
            data={rows}
            getRowId={(r) => r.employeeId}
            searchPlaceholder="Search employees"
            filters={[{ columnId: "department", title: "Department", options: deptOptions }]}
            dense
            showFooter
            pageSize={50}
          />
        </>
      )}
    </ReportLayout>
  )
}
