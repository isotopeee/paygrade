"use client"

import { useMemo, useState } from "react"
import { InfoIcon } from "lucide-react"

import { formatDate, registerName } from "@/lib/format"
import { ratesForDate } from "@/lib/payroll/rates"
import {
  buildLeaveMonetization,
  type LeaveMonetizationRow,
  type ReportMeta,
} from "@/lib/reports"
import { useDataStore } from "@/stores/data-store"
import { DEMO_TODAY } from "@/data/seed"
import { createColumns, DataTable, DataTableColumnHeader } from "@/components/data-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { amountColumn, FooterLabel } from "./columns"
import { FilterSelect, ReportLayout } from "./report-layout"

const col = createColumns<LeaveMonetizationRow & { department: string }>()

function days(value: number) {
  return value.toLocaleString("en-PH", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

const columns = col.columns([
  col.accessor("name", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
    cell: ({ row }) => (
      <div className="max-w-56 min-w-40">
        <div className="truncate font-medium">{row.original.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {row.original.employeeNo}, {row.original.position}
        </div>
      </div>
    ),
    footer: () => <FooterLabel>Totals</FooterLabel>,
    meta: { label: "Employee" },
  }),
  col.accessor("department", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
    filterFn: "arrHas",
    meta: { label: "Department" },
  }),
  col.accessor("vacationLeave", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="VL" />,
    cell: ({ getValue }) => days(getValue()),
    meta: { numeric: true, label: "Vacation leave" },
  }),
  col.accessor("sickLeave", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="SL" />,
    cell: ({ getValue }) => days(getValue()),
    meta: { numeric: true, label: "Sick leave" },
  }),
  amountColumn(col, "dailyRate", "Daily rate", { total: false }),
  col.accessor("days", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Monetizable days" />,
    cell: ({ getValue }) => <span className={getValue() === 0 ? "text-muted-foreground/50" : undefined}>{getValue()}</span>,
    footer: ({ table }) => {
      let total = 0
      for (const r of table.getFilteredRowModel().rows) total += r.original.days
      return total
    },
    meta: { numeric: true, label: "Monetizable days" },
  }),
  amountColumn(col, "amount", "Amount", { emphasize: true }),
])

export function LeaveMonetizationReport({ meta }: { meta: ReportMeta }) {
  const employees = useDataStore((s) => s.employees)
  const leaveCredits = useDataStore((s) => s.leaveCredits)
  const salarySchedules = useDataStore((s) => s.salarySchedules)
  const ratesVersions = useDataStore((s) => s.ratesVersions)
  const departments = useDataStore((s) => s.departments)
  const [scope, setScope] = useState<"all" | "eligible">("eligible")

  const allRows = useMemo(() => {
    const deptName = new Map(departments.map((d) => [d.id, d.name]))
    return buildLeaveMonetization({
      employees,
      leaveCredits,
      salarySchedules,
      ratesVersions,
      date: DEMO_TODAY,
      nameOf: registerName,
    }).map((r) => ({ ...r, department: deptName.get(r.departmentId) ?? r.departmentId }))
  }, [employees, leaveCredits, salarySchedules, ratesVersions, departments])
  const rows = useMemo(() => (scope === "eligible" ? allRows.filter((r) => r.days > 0) : allRows), [allRows, scope])
  const deptOptions = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.department))).sort().map((d) => ({ label: d, value: d })),
    [allRows]
  )
  const activeRates = ratesForDate(ratesVersions, DEMO_TODAY)
  const workingDays = activeRates.workingDaysPerMonth
  const leaveRules = activeRates.leaveMonetization
  const asOf = allRows[0]?.asOf

  return (
    <ReportLayout
      meta={meta}
      fileStem={`leave-monetization-${DEMO_TODAY}`}
      rows={rows.length}
      filters={
        <>
          <FilterSelect
            id="lm-scope"
            label="Show"
            value={scope}
            onChange={(v) => setScope(v === "all" ? "all" : "eligible")}
            options={[
              { value: "eligible", label: "With monetizable days" },
              { value: "all", label: "All plantilla with leave credits" },
            ]}
            className="w-64"
          />
          {asOf && <p className="pb-1.5 text-xs text-muted-foreground">Leave credits as of {formatDate(asOf)}</p>}
        </>
      }
    >
      <Alert>
        <InfoIcon aria-hidden />
        <AlertTitle>Seed rule, to be confirmed with HR</AlertTitle>
        <AlertDescription>
          Monetizable days are up to {leaveRules.maxDaysPerApplication} days of vacation leave beyond a retained balance of {leaveRules.retainedDays}{" "}
          days, rounded down to whole days. Daily rate is monthly basic salary divided by {workingDays} working days. Confirm against
          CSC and DBM rules on leave monetization before use.
        </AlertDescription>
      </Alert>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.employeeId}
        searchPlaceholder="Search employees"
        filters={[{ columnId: "department", title: "Department", options: deptOptions }]}
        dense
        showFooter
        pageSize={50}
        emptyState={{ title: "No leave credits", description: "No plantilla employee has monetizable vacation leave." }}
      />
    </ReportLayout>
  )
}
