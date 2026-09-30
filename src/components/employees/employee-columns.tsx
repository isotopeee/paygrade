"use client"

import type { Employee } from "@/types"
import { EMPLOYMENT_TYPE_SHORT } from "@/lib/constants"
import { formatCurrency, formatDate } from "@/lib/format"
import { createColumns, DataTableColumnHeader } from "@/components/data-table"
import { EmployeeStatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"

export interface EmployeeRow {
  employee: Employee
  name: string
  departmentName: string
  /** Monthly basic or monthly equivalent, for sorting the rate column. */
  monthlyEquivalent: number
}

export function rateLabel(employee: Employee): string {
  if (employee.rateType === "salary_grade") return `SG ${employee.salaryGrade ?? 1}, Step ${employee.step ?? 1}`
  const rate = formatCurrency(employee.contractRate ?? 0)
  return employee.rateType === "daily" ? `${rate} / day` : `${rate} / mo`
}

const col = createColumns<EmployeeRow>()

export const employeeColumns = col.columns([
  col.accessor((r) => r.employee.employeeNo, {
    id: "employeeNo",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Employee No." />,
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
    meta: { label: "Employee No.", cellClassName: "whitespace-nowrap" },
  }),
  col.accessor((r) => r.name, {
    id: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <div className="flex min-w-40 flex-col">
        <span className="font-medium">{row.original.name}</span>
        <span className="truncate text-xs text-muted-foreground">{row.original.employee.email}</span>
      </div>
    ),
    meta: { label: "Name" },
  }),
  col.accessor((r) => r.employee.positionTitle, {
    id: "position",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Position" />,
    meta: { label: "Position" },
  }),
  col.accessor((r) => r.departmentName, {
    id: "department",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
    filterFn: "arrHas",
    meta: { label: "Department" },
  }),
  col.accessor((r) => r.employee.employmentType, {
    id: "employmentType",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ getValue }) => <Badge variant="outline">{EMPLOYMENT_TYPE_SHORT[getValue()]}</Badge>,
    filterFn: "arrHas",
    meta: { label: "Employment type" },
  }),
  col.accessor((r) => r.monthlyEquivalent, {
    id: "rate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="SG / Rate" />,
    cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{rateLabel(row.original.employee)}</span>,
    enableGlobalFilter: false,
    meta: { label: "SG / Rate", numeric: true },
  }),
  col.accessor((r) => r.employee.dateHired, {
    id: "dateHired",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date hired" />,
    cell: ({ getValue }) => <span className="whitespace-nowrap tabular-nums">{formatDate(getValue())}</span>,
    enableGlobalFilter: false,
    meta: { label: "Date hired" },
  }),
  col.accessor((r) => r.employee.status, {
    id: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ getValue }) => <EmployeeStatusBadge status={getValue()} />,
    filterFn: "arrHas",
    enableGlobalFilter: false,
    meta: { label: "Status" },
  }),
])
