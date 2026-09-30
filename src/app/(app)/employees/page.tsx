"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BriefcaseIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PlaneIcon,
  PlusIcon,
  UserXIcon,
  UsersIcon,
} from "lucide-react"

import type { EmployeeStatus, EmploymentType } from "@/types"
import { EMPLOYEE_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, groupOf } from "@/lib/constants"
import { formatDate, fullName } from "@/lib/format"
import { monthlyRateOn } from "@/lib/payroll/engine"
import { can } from "@/lib/permissions"
import { useMockExport } from "@/hooks/use-mock-export"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { DEMO_TODAY } from "@/data/seed"
import { DataTable } from "@/components/data-table"
import { employeeColumns, type EmployeeRow } from "@/components/employees/employee-columns"
import { EmployeeFormSheet } from "@/components/employees/employee-form-sheet"
import { PageContainer, PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function EmployeesPage() {
  const router = useRouter()
  const role = useRole()
  const employees = useDataStore((s) => s.employees)
  const departments = useDataStore((s) => s.departments)
  const salarySchedules = useDataStore((s) => s.salarySchedules)
  const ratesVersions = useDataStore((s) => s.ratesVersions)
  const exportFile = useMockExport()
  const [formOpen, setFormOpen] = useState(false)
  const canManage = can(role, "employees.manage")

  const rows = useMemo<EmployeeRow[]>(() => {
    const deptNames = new Map(departments.map((d) => [d.id, d.name]))
    return employees.map((employee) => ({
      employee,
      name: fullName(employee),
      departmentName: deptNames.get(employee.departmentId) ?? employee.departmentId,
      monthlyEquivalent: monthlyRateOn({ salarySchedules, ratesVersions }, employee, DEMO_TODAY),
    }))
  }, [employees, departments, salarySchedules, ratesVersions])

  const stats = useMemo(() => {
    const current = employees.filter((e) => e.status !== "separated")
    return {
      headcount: current.length,
      plantilla: current.filter((e) => groupOf(e.employmentType) === "plantilla").length,
      joCos: current.filter((e) => groupOf(e.employmentType) === "jo_cos").length,
      onLeave: employees.filter((e) => e.status === "on_leave").length,
      separated: employees.filter((e) => e.status === "separated").length,
    }
  }, [employees])

  const filters = useMemo(
    () => [
      {
        columnId: "department",
        title: "Department",
        options: [...departments]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((d) => ({ label: d.name, value: d.name })),
      },
      {
        columnId: "employmentType",
        title: "Employment type",
        options: (Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]).map((t) => ({
          label: EMPLOYMENT_TYPE_LABELS[t],
          value: t,
        })),
      },
      {
        columnId: "status",
        title: "Status",
        options: (Object.keys(EMPLOYEE_STATUS_LABELS) as EmployeeStatus[]).map((s) => ({
          label: EMPLOYEE_STATUS_LABELS[s],
          value: s,
        })),
      },
    ],
    [departments]
  )

  const exportAll = (format: "PDF" | "Excel") =>
    exportFile({
      title: "Employee masterlist",
      format,
      fileStem: `MMWGH-Employee-Masterlist-${DEMO_TODAY}`,
      entity: "employee",
      entityId: "masterlist",
      rows: rows.length,
    })

  return (
    <PageContainer>
      <PageHeader
        title="Employees"
        description="Plantilla personnel and Job Order or Contract of Service workers of MMWGH, with appointment, rate, and government ID details."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <DownloadIcon data-icon="inline-start" aria-hidden />
                Export
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportAll("PDF")}>
                  <FileTextIcon aria-hidden />
                  Masterlist (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAll("Excel")}>
                  <FileSpreadsheetIcon aria-hidden />
                  Masterlist (Excel)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canManage && (
              <Button onClick={() => setFormOpen(true)}>
                <PlusIcon data-icon="inline-start" aria-hidden />
                Add employee
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Headcount" value={stats.headcount} hint="Excluding separated" icon={UsersIcon} />
        <StatCard label="Plantilla" value={stats.plantilla} hint="Permanent, casual, contractual" icon={BriefcaseIcon} />
        <StatCard label="JO/COS" value={stats.joCos} hint="Job Order and Contract of Service" icon={FileTextIcon} />
        <StatCard label="On leave" value={stats.onLeave} hint={`As of ${formatDate(DEMO_TODAY)}`} icon={PlaneIcon} />
        <StatCard label="Separated" value={stats.separated} hint="Retired, resigned, or ended" icon={UserXIcon} />
      </div>

      <DataTable
        columns={employeeColumns}
        data={rows}
        getRowId={(r) => r.employee.id}
        searchPlaceholder="Search name, employee no., position"
        filters={filters}
        initialSorting={[{ id: "name", desc: false }]}
        enableSelection
        selectionActions={(selected, clear) => (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => {
                exportFile({
                  title: "Selected employees",
                  format: "Excel",
                  fileStem: `MMWGH-Employees-Selected-${DEMO_TODAY}`,
                  entity: "employee",
                  entityId: "selection",
                  rows: selected.length,
                })
                clear()
              }}
            >
              <FileSpreadsheetIcon data-icon="inline-start" aria-hidden />
              Export to Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => {
                exportFile({
                  title: "Selected employees",
                  format: "PDF",
                  fileStem: `MMWGH-Employees-Selected-${DEMO_TODAY}`,
                  entity: "employee",
                  entityId: "selection",
                  rows: selected.length,
                })
                clear()
              }}
            >
              <FileTextIcon data-icon="inline-start" aria-hidden />
              Export to PDF
            </Button>
          </>
        )}
        onRowClick={(r) => router.push(`/employees/${r.employee.id}`)}
        rowLabel={(r) => `Open profile of ${r.name}`}
        emptyState={{
          icon: <UsersIcon />,
          title: "No employees yet",
          description: "Add plantilla personnel or JO and COS workers to start preparing payroll.",
          action: canManage ? (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              Add employee
            </Button>
          ) : undefined,
        }}
      />

      {canManage && <EmployeeFormSheet open={formOpen} onOpenChange={setFormOpen} />}
    </PageContainer>
  )
}
