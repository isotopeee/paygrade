"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleAlertIcon, ClockAlertIcon, FileUpIcon, MoonIcon, TimerIcon, UserCheckIcon } from "lucide-react"

import type { DtrSummary, EmployeeGroup } from "@/types"
import { GROUP_LABELS, groupOf } from "@/lib/constants"
import { formatHours, formatPeriod, registerName } from "@/lib/format"
import { daysRequiredInPeriod } from "@/lib/payroll/compute"
import { dtrKey, employeesForPeriod, indexDtr } from "@/lib/payroll/engine"
import { can } from "@/lib/permissions"
import { byId } from "@/lib/selectors"
import { CURRENT_PERIOD_ID } from "@/data/seed"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { createColumns, DataTable, DataTableColumnHeader } from "@/components/data-table"
import { PageContainer, PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { ImportDtrDialog } from "./import-dialog"
import { PeriodSelect, useDtrPeriods } from "./period-select"
import { DtrSourceBadge } from "./source-badge"

interface AttendanceRow {
  employeeId: string
  employeeNo: string
  name: string
  department: string
  departmentName: string
  group: EmployeeGroup
  daysRequired: number
  summary?: DtrSummary
  dtrStatus: "with" | "missing"
}

const col = createColumns<AttendanceRow>()

function NoValue() {
  return (
    <span className="text-muted-foreground/60">
      <span aria-hidden>·</span>
      <span className="sr-only">No record</span>
    </span>
  )
}

const num = (pick: (s: DtrSummary) => number) => (row: AttendanceRow) => (row.summary ? pick(row.summary) : -1)

function NumberCell({ row, value, format = String }: { row: AttendanceRow; value: number; format?: (n: number) => string }) {
  if (!row.summary) return <NoValue />
  return <span className={value === 0 ? "text-muted-foreground/60" : undefined}>{format(value)}</span>
}

export function AttendanceSummary() {
  const router = useRouter()
  const role = useRole()
  const employees = useDataStore((s) => s.employees)
  const departments = useDataStore((s) => s.departments)
  const dtr = useDataStore((s) => s.dtr)
  const periods = useDtrPeriods()
  const canManage = can(role, "attendance.manage")

  const [periodId, setPeriodId] = useState(CURRENT_PERIOD_ID)
  const [group, setGroup] = useState<"all" | EmployeeGroup>("all")
  const [importOpen, setImportOpen] = useState(false)

  const period = periods.find((p) => p.id === periodId) ?? periods[0]

  const rows = useMemo<AttendanceRow[]>(() => {
    if (!period) return []
    const index = indexDtr(dtr)
    const departmentsById = byId(departments)
    const groups: EmployeeGroup[] = group === "all" ? ["plantilla", "jo_cos"] : [group]
    return groups
      .flatMap((g) => employeesForPeriod(employees, g, period.start, period.end))
      .map((e) => {
        const summary = index.get(dtrKey(period.id, e.id))
        return {
          employeeId: e.id,
          employeeNo: e.employeeNo,
          name: registerName(e),
          department: e.departmentId,
          departmentName: departmentsById.get(e.departmentId)?.name ?? e.departmentId,
          group: groupOf(e.employmentType),
          daysRequired: summary?.daysRequired ?? daysRequiredInPeriod(e, period),
          summary,
          dtrStatus: summary ? "with" : "missing",
        }
      })
  }, [period, dtr, departments, employees, group])

  const stats = useMemo(() => {
    const withDtr = rows.filter((r) => r.summary)
    const sum = (pick: (s: DtrSummary) => number) => withDtr.reduce((acc, r) => acc + (r.summary ? pick(r.summary) : 0), 0)
    return {
      withDtr: withDtr.length,
      missing: rows.length - withDtr.length,
      tardyHours: sum((s) => s.tardinessMinutes + s.undertimeMinutes) / 60,
      otHours: sum((s) => s.overtimeHoursRegular + s.overtimeHoursRestDay),
      otRestDay: sum((s) => s.overtimeHoursRestDay),
      ndHours: sum((s) => s.nightDiffHours),
    }
  }, [rows])

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("employeeNo", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Employee No." />,
          cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
          meta: { label: "Employee No." },
        }),
        col.accessor("name", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
          cell: ({ getValue }) => <span className="font-medium whitespace-nowrap">{getValue()}</span>,
          meta: { label: "Name" },
        }),
        col.accessor("department", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
          cell: ({ row }) => <span className="whitespace-nowrap">{row.original.departmentName}</span>,
          filterFn: "arrHas",
          meta: { label: "Department" },
        }),
        col.accessor("group", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Group" />,
          cell: ({ getValue }) => GROUP_LABELS[getValue()],
          filterFn: "arrHas",
          meta: { label: "Group" },
        }),
        col.accessor("daysRequired", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Days req." />,
          meta: { label: "Days required", numeric: true },
        }),
        col.accessor(num((s) => s.daysWorked), {
          id: "daysWorked",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Worked" />,
          cell: ({ row, getValue }) => <NumberCell row={row.original} value={getValue()} />,
          meta: { label: "Days worked", numeric: true },
        }),
        col.accessor(num((s) => s.leaveWithPayDays), {
          id: "leave",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Leave" />,
          cell: ({ row, getValue }) => <NumberCell row={row.original} value={getValue()} />,
          meta: { label: "Leave with pay", numeric: true },
        }),
        col.accessor(num((s) => s.absencesWithoutPay), {
          id: "absences",
          header: ({ column }) => <DataTableColumnHeader column={column} title="LWOP" />,
          cell: ({ row, getValue }) => <NumberCell row={row.original} value={getValue()} />,
          meta: { label: "Absences (LWOP)", numeric: true },
        }),
        col.accessor(num((s) => s.tardinessMinutes), {
          id: "tardiness",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Late (min)" />,
          cell: ({ row, getValue }) => <NumberCell row={row.original} value={getValue()} />,
          meta: { label: "Tardiness (min)", numeric: true },
        }),
        col.accessor(num((s) => s.undertimeMinutes), {
          id: "undertime",
          header: ({ column }) => <DataTableColumnHeader column={column} title="UT (min)" />,
          cell: ({ row, getValue }) => <NumberCell row={row.original} value={getValue()} />,
          meta: { label: "Undertime (min)", numeric: true },
        }),
        col.accessor(num((s) => s.overtimeHoursRegular + s.overtimeHoursRestDay), {
          id: "overtime",
          header: ({ column }) => <DataTableColumnHeader column={column} title="OT (h)" />,
          cell: ({ row, getValue }) => {
            const s = row.original.summary
            if (!s) return <NoValue />
            const total = getValue()
            if (total === 0) return <span className="text-muted-foreground/60">0</span>
            return (
              <Tooltip>
                <TooltipTrigger
                  render={<span className="cursor-help underline decoration-dotted underline-offset-4" />}
                  onClick={(e) => e.stopPropagation()}
                >
                  {formatHours(total)}
                </TooltipTrigger>
                <TooltipContent>
                  Regular day {formatHours(s.overtimeHoursRegular)} h, rest day {formatHours(s.overtimeHoursRestDay)} h
                </TooltipContent>
              </Tooltip>
            )
          },
          meta: { label: "OT hours", numeric: true },
        }),
        col.accessor(num((s) => s.nightDiffHours), {
          id: "nightDiff",
          header: ({ column }) => <DataTableColumnHeader column={column} title="ND (h)" />,
          cell: ({ row, getValue }) => <NumberCell row={row.original} value={getValue()} format={formatHours} />,
          meta: { label: "Night diff hours", numeric: true },
        }),
        col.accessor("dtrStatus", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
          cell: ({ row }) => <DtrSourceBadge source={row.original.summary?.source} />,
          filterFn: "arrHas",
          meta: { label: "Source" },
        }),
      ]),
    []
  )

  const departmentOptions = useMemo(() => {
    const used = new Set(rows.map((r) => r.department))
    return departments.filter((d) => used.has(d.id)).map((d) => ({ label: d.name, value: d.id }))
  }, [rows, departments])

  if (!period) return null
  const periodLabel = formatPeriod(period.start, period.end)

  return (
    <PageContainer>
      <PageHeader
        title="Time and Attendance"
        description="Daily time record summaries per payroll period. Payroll computes tardiness, absences, overtime, and night differential from these records."
        actions={
          <>
            <Field orientation="horizontal" className="w-auto">
              <FieldLabel htmlFor="dtr-period" className="sr-only">
                Payroll period
              </FieldLabel>
              <PeriodSelect value={period.id} onChange={setPeriodId} />
            </Field>
            <Field orientation="horizontal" className="w-auto">
              <FieldLabel htmlFor="dtr-group" className="sr-only">
                Employee group
              </FieldLabel>
              <NativeSelect
                id="dtr-group"
                value={group}
                onChange={(e) => setGroup(e.target.value as "all" | EmployeeGroup)}
              >
                <NativeSelectOption value="all">All groups</NativeSelectOption>
                <NativeSelectOption value="plantilla">Plantilla</NativeSelectOption>
                <NativeSelectOption value="jo_cos">JO/COS</NativeSelectOption>
              </NativeSelect>
            </Field>
            {canManage && (
              <Button onClick={() => setImportOpen(true)}>
                <FileUpIcon data-icon="inline-start" />
                Import biometric logs
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Employees with DTR" value={stats.withDtr} icon={UserCheckIcon} hint={`of ${rows.length} in service`} />
        <StatCard
          label="Missing DTR"
          value={stats.missing}
          icon={CircleAlertIcon}
          hint={stats.missing > 0 ? "Blocks accurate payroll computation" : "All employees have records"}
        />
        <StatCard
          label="Tardiness and undertime"
          value={`${stats.tardyHours.toFixed(1)} h`}
          icon={ClockAlertIcon}
          hint="Deducted from basic pay"
        />
        <StatCard
          label="Overtime"
          value={`${formatHours(stats.otHours)} h`}
          icon={TimerIcon}
          hint={`${formatHours(stats.otRestDay)} h on rest days`}
        />
        <StatCard label="Night differential" value={`${formatHours(stats.ndHours)} h`} icon={MoonIcon} hint="10:00 PM to 6:00 AM" />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.employeeId}
        searchPlaceholder="Search name or employee no."
        filters={[
          { columnId: "department", title: "Department", options: departmentOptions },
          {
            columnId: "group",
            title: "Group",
            options: [
              { label: GROUP_LABELS.plantilla, value: "plantilla" },
              { label: GROUP_LABELS.jo_cos, value: "jo_cos" },
            ],
          },
          {
            columnId: "dtrStatus",
            title: "DTR status",
            options: [
              { label: "With DTR", value: "with" },
              { label: "Missing DTR", value: "missing", icon: CircleAlertIcon },
            ],
          },
        ]}
        initialSorting={[{ id: "name", desc: false }]}
        onRowClick={(row) => router.push(`/attendance/${row.employeeId}?period=${period.id}`)}
        rowLabel={(row) => `Open daily time record of ${row.name} for ${periodLabel}`}
        dense
        emptyState={{
          title: "No employees in service",
          description: `No employees were in service from ${periodLabel}.`,
        }}
      />

      {canManage && <ImportDtrDialog open={importOpen} onOpenChange={setImportOpen} period={period} />}
    </PageContainer>
  )
}
