"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CircleCheckBigIcon, CircleDashedIcon, DownloadIcon, FileStackIcon, FileTextIcon } from "lucide-react"

import type { PayrollLine, PayrollRun } from "@/types"
import { RUN_STATUS_LABELS } from "@/lib/constants"
import { formatDate, formatDateTime, formatNumber } from "@/lib/format"
import { can } from "@/lib/permissions"
import { departmentName } from "@/lib/selectors"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { useMockExport } from "@/hooks/use-mock-export"
import { DataTable, DataTableColumnHeader, createColumns } from "@/components/data-table"
import { Money } from "@/components/money"
import { PageContainer, PageHeader } from "@/components/page-header"
import { RunStatusBadge, StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { BatchGenerateDialog } from "./batch-generate-dialog"
import { GeneratePayslipsDialog } from "./generate-payslips-dialog"
import { canGenerateFor, defaultPayslipRun, payslipRunLabel, payslipRuns } from "./run-label"

interface PayslipRow extends PayrollLine {
  department: string
  generated: boolean
}

const col = createColumns<PayslipRow>()

const columns = col.columns([
  col.accessor("employeeNo", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Employee No." />,
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
    meta: { label: "Employee No." },
  }),
  col.accessor("employeeName", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    meta: { label: "Name" },
  }),
  col.accessor("department", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
    filterFn: "arrHas",
    cell: ({ getValue }) => <span className="block max-w-56 truncate">{getValue()}</span>,
    meta: { label: "Department" },
  }),
  col.accessor("positionTitle", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Position" />,
    cell: ({ getValue }) => <span className="block max-w-56 truncate text-muted-foreground">{getValue()}</span>,
    meta: { label: "Position" },
  }),
  col.accessor("gross", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Gross" />,
    cell: ({ getValue }) => <Money value={getValue()} plain />,
    meta: { numeric: true, label: "Gross" },
  }),
  col.accessor("totalDeductions", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Deductions" />,
    cell: ({ getValue }) => <Money value={getValue()} plain />,
    meta: { numeric: true, label: "Deductions" },
  }),
  col.accessor("net", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Net" />,
    cell: ({ getValue }) => <Money value={getValue()} plain className="font-medium" />,
    meta: { numeric: true, label: "Net" },
  }),
  col.accessor("generated", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Payslip" />,
    enableSorting: false,
    cell: ({ getValue }) =>
      getValue() ? (
        <StatusBadge label="Generated" icon={CircleCheckBigIcon} tone="solid" />
      ) : (
        <StatusBadge label="Not generated" icon={CircleDashedIcon} tone="outline" />
      ),
    meta: { label: "Payslip" },
  }),
])

export function PayslipsView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const role = useRole()
  const runs = useDataStore((s) => s.runs)
  const departments = useDataStore((s) => s.departments)
  const exportFile = useMockExport()

  const available = React.useMemo(() => payslipRuns(runs), [runs])
  const [pickedId, setPickedId] = React.useState<string | null>(searchParams.get("run"))
  const run = available.find((r) => r.id === pickedId) ?? defaultPayslipRun(runs)
  const [job, setJob] = React.useState<PayrollRun[] | null>(null)

  const rows = React.useMemo<PayslipRow[]>(
    () =>
      (run?.lines ?? []).map((line) => ({
        ...line,
        department: departmentName(departments, line.departmentId),
        generated: !!run?.payslipsGeneratedAt,
      })),
    [run, departments]
  )

  const departmentOptions = React.useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.department)))
        .sort()
        .map((d) => ({ label: d, value: d })),
    [rows]
  )

  const selectRun = (id: string) => {
    setPickedId(id)
    router.replace(`/payslips?run=${encodeURIComponent(id)}`, { scroll: false })
  }

  const mayGenerate = can(role, "payslips.generate")

  if (!run) {
    return (
      <PageContainer>
        <PageHeader title="Payslips" description="Generate, print, and download employee payslips per payroll run." />
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>No computed payroll runs yet</EmptyTitle>
            <EmptyDescription>Payslips become available once a payroll run has been computed.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PageContainer>
    )
  }

  const eligible = canGenerateFor(run)
  const generateButton = (
    <Button onClick={() => setJob([run])} disabled={!eligible}>
      <FileStackIcon data-icon="inline-start" aria-hidden />
      {run.payslipsGeneratedAt ? "Regenerate payslips" : "Generate payslips"}
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Payslips"
        description="Generate, print, and download employee payslips per payroll run."
        actions={
          mayGenerate ? (
            <>
              <BatchGenerateDialog runs={available} onStart={setJob} />
              {eligible ? (
                generateButton
              ) : (
                <Tooltip>
                  <TooltipTrigger render={<span tabIndex={0} className="inline-flex rounded-lg" />}>
                    {generateButton}
                  </TooltipTrigger>
                  <TooltipContent>
                    Payslips can be generated once the Chief of Hospital approves the run. This run is{" "}
                    {RUN_STATUS_LABELS[run.status].toLowerCase()}.
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg border px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="payslip-run" className="text-xs font-medium text-muted-foreground">
            Payroll run
          </label>
          <NativeSelect
            id="payslip-run"
            value={run.id}
            onChange={(e) => selectRun(e.target.value)}
            className="w-full sm:w-96"
          >
            {available.map((r) => (
              <NativeSelectOption key={r.id} value={r.id}>
                {payslipRunLabel(r)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Run</dt>
            <dd className="font-mono text-xs">{run.code}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd>
              <RunStatusBadge status={run.status} />
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Pay date</dt>
            <dd className="tabular-nums">{formatDate(run.payDate)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Employees</dt>
            <dd className="tabular-nums">{formatNumber(run.lines.length)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Payslips</dt>
            <dd>
              {run.payslipsGeneratedAt ? (
                <span className="flex items-center gap-2">
                  <StatusBadge label="Generated" icon={CircleCheckBigIcon} tone="solid" />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(run.payslipsGeneratedAt)}
                  </span>
                </span>
              ) : (
                <StatusBadge label="Not generated" icon={CircleDashedIcon} tone="outline" />
              )}
            </dd>
          </div>
        </dl>
      </div>

      <DataTable
        key={run.id}
        columns={columns}
        data={rows}
        getRowId={(r) => r.employeeId}
        searchPlaceholder="Search employees"
        filters={[{ columnId: "department", title: "Department", options: departmentOptions }]}
        initialSorting={[{ id: "employeeName", desc: false }]}
        enableSelection
        selectionActions={(selected, clear) => (
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            onClick={() => {
              exportFile({
                title: `Payslips for ${run.code}`,
                format: "PDF",
                fileStem: `payslips-${run.code}-${selected.length}-employees`,
                entity: "payslip",
                entityId: run.id,
                rows: selected.length,
              })
              clear()
            }}
          >
            <DownloadIcon data-icon="inline-start" aria-hidden />
            Download selected (PDF)
          </Button>
        )}
        onRowClick={(row) => router.push(`/payslips/${run.id}/${row.employeeId}`)}
        rowLabel={(row) => `Open payslip of ${row.employeeName}`}
        emptyState={{
          icon: <FileTextIcon />,
          title: "No employees in this run",
          description: "The selected payroll run has no computed lines.",
        }}
      />

      {job && <GeneratePayslipsDialog runs={job} onClose={() => setJob(null)} />}
    </PageContainer>
  )
}
