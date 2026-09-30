"use client"

import { useMemo, useState } from "react"

import { HOSPITAL } from "@/lib/constants"
import { formatDate, formatPeriod } from "@/lib/format"
import { buildGeneralPayroll, reportableRuns, type GeneralPayrollRow, type ReportMeta } from "@/lib/reports"
import { runLabel, useDataStore } from "@/stores/data-store"
import { createColumns, DataTable, DataTableColumnHeader } from "@/components/data-table"
import { RunStatusBadge } from "@/components/status-badge"

import { amountColumn, FooterLabel } from "./columns"
import { NoRunsState } from "./no-data"
import { FilterSelect, ReportLayout } from "./report-layout"
import { CertificationBox, SignatureBlock } from "./signature-block"

const col = createColumns<GeneralPayrollRow>()

const columns = col.columns([
  col.accessor("no", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="No." />,
    cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{getValue()}</span>,
    footer: () => <FooterLabel>Totals</FooterLabel>,
    meta: { label: "No.", cellClassName: "w-10" },
  }),
  col.accessor("name", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <div className="max-w-52 min-w-36">
        <div className="truncate font-medium">{row.original.name}</div>
        <div className="font-mono text-[0.6875rem] text-muted-foreground">{row.original.employeeNo}</div>
      </div>
    ),
    footer: ({ table }) => <FooterLabel>{table.getFilteredRowModel().rows.length} employees</FooterLabel>,
    meta: { label: "Name" },
  }),
  col.accessor("position", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Position" />,
    cell: ({ getValue }) => <span className="block max-w-44 truncate text-muted-foreground">{getValue()}</span>,
    meta: { label: "Position" },
  }),
  col.accessor("rate", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="SG/Step or rate" />,
    cell: ({ getValue }) => <span className="whitespace-nowrap tabular-nums">{getValue()}</span>,
    meta: { label: "SG/Step or rate" },
  }),
  amountColumn(col, "monthlyRate", "Monthly rate", { total: false }),
  amountColumn(col, "basic", "Basic earned"),
  amountColumn(col, "pera", "PERA"),
  amountColumn(col, "allowances", "Allowances"),
  amountColumn(col, "gross", "Gross", { emphasize: true }),
  amountColumn(col, "gsis", "GSIS"),
  amountColumn(col, "philhealth", "PhilHealth"),
  amountColumn(col, "pagibig", "Pag-IBIG"),
  amountColumn(col, "tax", "W/Tax"),
  amountColumn(col, "loans", "Loans"),
  amountColumn(col, "other", "Other deductions"),
  amountColumn(col, "totalDeductions", "Total deductions"),
  amountColumn(col, "net", "Net", { emphasize: true }),
  col.display({
    id: "signature",
    header: () => <span className="text-xs font-medium text-muted-foreground">Signature</span>,
    cell: () => <span className="block h-5 w-24 border-b border-dashed" aria-label="Signature line" />,
    enableHiding: true,
    meta: { label: "Signature" },
  }),
])

export function GeneralPayrollReport({ meta }: { meta: ReportMeta }) {
  const runs = useDataStore((s) => s.runs)
  const employees = useDataStore((s) => s.employees)
  const signatories = useDataStore((s) => s.signatories)
  const options = useMemo(() => reportableRuns(runs, { regularOnly: true }), [runs])
  const [runId, setRunId] = useState(() => options[0]?.id ?? "")
  const run = options.find((r) => r.id === runId) ?? options[0]
  const rows = useMemo(() => (run ? buildGeneralPayroll(run, employees) : []), [run, employees])
  const sig = (role: string) => signatories.find((s) => s.role === role)

  return (
    <ReportLayout
      meta={meta}
      fileStem={`general-payroll-${run?.code ?? "none"}`}
      rows={rows.length}
      exportDisabled={!run}
      filters={
        <>
          <FilterSelect
            id="gp-run"
            label="Payroll run"
            value={run?.id ?? ""}
            onChange={setRunId}
            options={options.map((r) => ({ value: r.id, label: runLabel(r) }))}
            className="w-96 max-w-full"
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
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <div className="text-sm font-semibold tracking-wide uppercase">General Payroll</div>
            <div className="text-xs text-muted-foreground">
              {HOSPITAL.name}, {HOSPITAL.address}
            </div>
            <div className="text-xs text-muted-foreground">
              {run.title}, for the period {formatPeriod(run.periodStart, run.periodEnd)}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              We acknowledge receipt of cash shown opposite our name as full compensation for services rendered for the period covered.
            </p>
          </div>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(r) => r.employeeId}
            searchPlaceholder="Search employees"
            dense
            showFooter
            hidePagination
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CertificationBox
              letter="A"
              statement="Certified: Services duly rendered as stated."
              name={sig("reviewed_by")?.name ?? ""}
              position={sig("reviewed_by")?.position ?? ""}
            />
            <CertificationBox
              letter="B"
              statement="Certified: Supporting documents complete and proper; cash available in the amount of the net total above."
              name={sig("certified_by")?.name ?? ""}
              position={sig("certified_by")?.position ?? ""}
            />
            <CertificationBox
              letter="C"
              statement="Approved for payment."
              name={sig("approved_by")?.name ?? ""}
              position={sig("approved_by")?.position ?? ""}
            />
            <CertificationBox
              letter="D"
              statement="Certified: Each employee whose name appears above has been paid the amount indicated opposite his or her name."
              name={sig("released_by")?.name ?? ""}
              position={sig("released_by")?.position ?? ""}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Prepared by</div>
              <SignatureBlock
                name={sig("prepared_by")?.name ?? ""}
                position={sig("prepared_by")?.position ?? ""}
                className="items-start pt-6 text-left"
              />
            </div>
          </div>
        </div>
      )}
    </ReportLayout>
  )
}
