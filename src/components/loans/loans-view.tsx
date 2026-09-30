"use client"

import * as React from "react"
import { addDays, parseISO } from "date-fns"
import { CalendarClockIcon, DownloadIcon, HandCoinsIcon, LandmarkIcon, ListChecksIcon, WalletIcon } from "lucide-react"

import type { Loan, LoanStatus, LoanType } from "@/types"
import { LOAN_STATUS_LABELS, LOAN_TYPE_AGENCY, LOAN_TYPE_LABELS } from "@/lib/constants"
import { formatCurrency, formatDate, formatMonth, formatNumber, registerName } from "@/lib/format"
import { loanBalance, loanProgress } from "@/lib/loans"
import { toISODate } from "@/lib/payroll/calendar"
import { can } from "@/lib/permissions"
import { byId } from "@/lib/selectors"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { DEMO_TODAY } from "@/data/seed"
import { useMockExport } from "@/hooks/use-mock-export"
import { DataTable, DataTableColumnHeader, createColumns } from "@/components/data-table"
import { Money } from "@/components/money"
import { PageContainer, PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { LoanStatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

import { AddLoanDialog } from "./add-loan-dialog"
import { LoanSheet } from "./loan-sheet"

interface LoanRow extends Loan {
  employeeName: string
  employeeNo: string
  typeLabel: string
  agency: string
  statusLabel: string
  balance: number
  progress: number
}

const col = createColumns<LoanRow>()

const columns = col.columns([
  col.accessor("referenceNo", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Reference No." />,
    cell: ({ getValue }) => <span className="font-mono text-xs whitespace-nowrap">{getValue()}</span>,
    meta: { label: "Reference No." },
  }),
  col.accessor("employeeName", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
    cell: ({ row }) => (
      <div className="min-w-40">
        <div className="truncate font-medium">{row.original.employeeName}</div>
        <div className="font-mono text-xs text-muted-foreground">{row.original.employeeNo}</div>
      </div>
    ),
    meta: { label: "Employee" },
  }),
  col.accessor("typeLabel", {
    id: "type",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    filterFn: "arrHas",
    cell: ({ getValue }) => <span className="block max-w-48 truncate">{getValue()}</span>,
    meta: { label: "Type" },
  }),
  col.accessor("agency", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Agency" />,
    filterFn: "arrHas",
    meta: { label: "Agency" },
  }),
  col.accessor("principal", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Principal" />,
    cell: ({ getValue }) => <Money value={getValue()} plain />,
    meta: { numeric: true, label: "Principal" },
  }),
  col.accessor("monthlyAmortization", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Monthly" />,
    cell: ({ getValue }) => <Money value={getValue()} plain />,
    meta: { numeric: true, label: "Monthly amortization" },
  }),
  col.accessor("totalPayable", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total payable" />,
    cell: ({ getValue }) => <Money value={getValue()} plain />,
    meta: { numeric: true, label: "Total payable" },
  }),
  col.accessor("paidToDate", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Paid to date" />,
    cell: ({ getValue }) => <Money value={getValue()} plain />,
    meta: { numeric: true, label: "Paid to date" },
  }),
  col.accessor("balance", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
    cell: ({ getValue }) => <Money value={getValue()} plain muteZero className="font-medium" />,
    meta: { numeric: true, label: "Balance" },
  }),
  col.accessor("progress", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Progress" />,
    cell: ({ getValue }) => (
      <div className="flex w-28 items-center gap-2">
        <Progress value={getValue()} aria-label={`${getValue()}% paid`} className="flex-1" />
        <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{getValue()}%</span>
      </div>
    ),
    meta: { label: "Progress" },
  }),
  col.accessor("startPeriod", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Start" />,
    cell: ({ getValue }) => <span className="whitespace-nowrap tabular-nums">{formatMonth(getValue())}</span>,
    meta: { label: "Start" },
  }),
  col.accessor("endPeriod", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="End" />,
    cell: ({ getValue }) => <span className="whitespace-nowrap tabular-nums">{formatDate(getValue())}</span>,
    meta: { label: "End" },
  }),
  col.accessor("statusLabel", {
    id: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    filterFn: "arrHas",
    cell: ({ row }) => <LoanStatusBadge status={row.original.status} />,
    meta: { label: "Status" },
  }),
])

const TYPE_OPTIONS = (Object.keys(LOAN_TYPE_LABELS) as LoanType[]).map((t) => ({
  label: LOAN_TYPE_LABELS[t],
  value: LOAN_TYPE_LABELS[t],
}))
const AGENCY_OPTIONS = Array.from(new Set(Object.values(LOAN_TYPE_AGENCY))).map((a) => ({ label: a, value: a }))
const STATUS_OPTIONS = (Object.keys(LOAN_STATUS_LABELS) as LoanStatus[]).map((s) => ({
  label: LOAN_STATUS_LABELS[s],
  value: LOAN_STATUS_LABELS[s],
}))

export function LoansView() {
  const role = useRole()
  const loans = useDataStore((s) => s.loans)
  const employees = useDataStore((s) => s.employees)
  const exportFile = useMockExport()
  const [sheetId, setSheetId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const canManage = can(role, "loans.manage")

  const employeeMap = React.useMemo(() => byId(employees), [employees])

  const rows = React.useMemo<LoanRow[]>(
    () =>
      loans.map((loan) => {
        const e = employeeMap.get(loan.employeeId)
        return {
          ...loan,
          employeeName: e ? registerName(e) : loan.employeeId,
          employeeNo: e?.employeeNo ?? "",
          typeLabel: LOAN_TYPE_LABELS[loan.type],
          agency: LOAN_TYPE_AGENCY[loan.type],
          statusLabel: LOAN_STATUS_LABELS[loan.status],
          balance: loanBalance(loan),
          progress: loanProgress(loan),
        }
      }),
    [loans, employeeMap]
  )

  const stats = React.useMemo(() => {
    const horizon = toISODate(addDays(parseISO(DEMO_TODAY), 90))
    const active = loans.filter((l) => l.status === "active")
    const open = loans.filter((l) => l.status !== "fully_paid")
    return {
      active: active.length,
      suspended: loans.filter((l) => l.status === "suspended").length,
      outstanding: open.reduce((n, l) => n + loanBalance(l), 0),
      monthly: active.reduce((n, l) => n + l.monthlyAmortization, 0),
      borrowers: new Set(active.map((l) => l.employeeId)).size,
      ending: active.filter((l) => l.endPeriod >= DEMO_TODAY && l.endPeriod <= horizon).length,
      openCount: open.length,
    }
  }, [loans])

  const selected = sheetId ? loans.find((l) => l.id === sheetId) : undefined

  return (
    <PageContainer>
      <PageHeader
        title="Deductions and Loans"
        description="GSIS, Pag-IBIG, cooperative, and bank salary loans deducted through payroll, with amortization schedules."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                exportFile({
                  title: "Loan and deduction ledger",
                  format: "Excel",
                  fileStem: `loan-ledger-${DEMO_TODAY}`,
                  entity: "loan",
                  rows: loans.length,
                })
              }
            >
              <DownloadIcon data-icon="inline-start" aria-hidden />
              Export ledger
            </Button>
            {canManage && <AddLoanDialog />}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active loans"
          value={formatNumber(stats.active)}
          icon={ListChecksIcon}
          hint={`${formatNumber(stats.borrowers)} employees, ${formatNumber(stats.suspended)} suspended`}
        />
        <StatCard
          label="Outstanding balance"
          value={formatCurrency(stats.outstanding)}
          icon={WalletIcon}
          hint={`Across ${formatNumber(stats.openCount)} active and suspended loans`}
        />
        <StatCard
          label="Monthly amortization"
          value={formatCurrency(stats.monthly)}
          icon={HandCoinsIcon}
          hint="Deducted from each monthly payroll"
        />
        <StatCard
          label="Ending within 90 days"
          value={formatNumber(stats.ending)}
          icon={CalendarClockIcon}
          hint={`Final deduction on or before ${formatDate(toISODate(addDays(parseISO(DEMO_TODAY), 90)))}`}
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        dense
        searchPlaceholder="Search reference or employee"
        filters={[
          { columnId: "type", title: "Type", options: TYPE_OPTIONS },
          { columnId: "agency", title: "Agency", options: AGENCY_OPTIONS },
          { columnId: "status", title: "Status", options: STATUS_OPTIONS },
        ]}
        initialSorting={[{ id: "employeeName", desc: false }]}
        onRowClick={(row) => {
          setSheetId(row.id)
          setSheetOpen(true)
        }}
        rowLabel={(row) => `Open ${row.typeLabel} ${row.referenceNo} of ${row.employeeName}`}
        activeRowId={sheetOpen ? (sheetId ?? undefined) : undefined}
        emptyState={{
          icon: <LandmarkIcon />,
          title: "No loans or deductions",
          description: "Authorized payroll deductions appear here once recorded.",
          action: canManage ? <AddLoanDialog /> : undefined,
        }}
      />

      <LoanSheet
        loan={selected}
        employee={selected ? employeeMap.get(selected.employeeId) : undefined}
        canManage={canManage}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </PageContainer>
  )
}
