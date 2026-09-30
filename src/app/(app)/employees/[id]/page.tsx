"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeftIcon, PencilIcon, ReceiptTextIcon, UserSearchIcon } from "lucide-react"

import { EMPLOYMENT_TYPE_LABELS } from "@/lib/constants"
import { fullName } from "@/lib/format"
import { can } from "@/lib/permissions"
import { departmentName } from "@/lib/selectors"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { EmployeeFormSheet } from "@/components/employees/employee-form-sheet"
import { CompensationTab } from "@/components/employees/profile/compensation-tab"
import { DeductionsTab } from "@/components/employees/profile/deductions-tab"
import { DocumentsTab } from "@/components/employees/profile/documents-tab"
import { EmploymentTab } from "@/components/employees/profile/employment-tab"
import { LeaveTab } from "@/components/employees/profile/leave-tab"
import { PayslipsTab } from "@/components/employees/profile/payslips-tab"
import { PersonalTab } from "@/components/employees/profile/personal-tab"
import { PageContainer } from "@/components/page-header"
import { EmployeeStatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TABS = [
  { value: "personal", label: "Personal Info" },
  { value: "employment", label: "Employment" },
  { value: "compensation", label: "Compensation" },
  { value: "deductions", label: "Deductions and Loans" },
  { value: "leave", label: "Leave Credits" },
  { value: "payslips", label: "Payslip History" },
  { value: "documents", label: "Documents" },
] as const

type TabValue = (typeof TABS)[number]["value"]

function isTab(value: unknown): value is TabValue {
  return TABS.some((t) => t.value === value)
}

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const role = useRole()
  const employee = useDataStore((s) => s.employees.find((e) => e.id === id))
  const departments = useDataStore((s) => s.departments)
  const [tab, setTab] = useState<TabValue>("personal")
  const [editOpen, setEditOpen] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)
  const canManage = can(role, "employees.manage")

  if (!employee) {
    return (
      <PageContainer>
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserSearchIcon />
            </EmptyMedia>
            <EmptyTitle>Employee not found</EmptyTitle>
            <EmptyDescription>
              No employee record matches this link. It may have been mistyped, or the demo data was reset.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" render={<Link href="/employees" />}>
              <ArrowLeftIcon data-icon="inline-start" aria-hidden />
              Back to employees
            </Button>
          </EmptyContent>
        </Empty>
      </PageContainer>
    )
  }

  const name = fullName(employee)
  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase()

  const viewPayslips = () => {
    setTab("payslips")
    requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" render={<Link href="/employees" />}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden />
          Employees
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="bg-foreground text-lg font-semibold text-background">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
                <span className="font-mono text-sm text-muted-foreground">{employee.employeeNo}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {employee.positionTitle}, {departmentName(departments, employee.departmentId)}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{EMPLOYMENT_TYPE_LABELS[employee.employmentType]}</Badge>
                <EmployeeStatusBadge status={employee.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={viewPayslips}>
              <ReceiptTextIcon data-icon="inline-start" aria-hidden />
              View payslips
            </Button>
            {canManage && (
              <Button onClick={() => setEditOpen(true)}>
                <PencilIcon data-icon="inline-start" aria-hidden />
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <div ref={tabsRef} className="scroll-mt-16">
        <Tabs value={tab} onValueChange={(value) => isTab(value) && setTab(value)} className="gap-4">
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList variant="line" className="w-max justify-start">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="flex-none px-2.5">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="personal">
            <PersonalTab employee={employee} />
          </TabsContent>
          <TabsContent value="employment">
            <EmploymentTab employee={employee} />
          </TabsContent>
          <TabsContent value="compensation">
            <CompensationTab employee={employee} />
          </TabsContent>
          <TabsContent value="deductions">
            <DeductionsTab employee={employee} />
          </TabsContent>
          <TabsContent value="leave">
            <LeaveTab employee={employee} />
          </TabsContent>
          <TabsContent value="payslips">
            <PayslipsTab employeeId={employee.id} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab employee={employee} canManage={canManage} />
          </TabsContent>
        </Tabs>
      </div>

      {canManage && <EmployeeFormSheet open={editOpen} onOpenChange={setEditOpen} employee={employee} />}
    </PageContainer>
  )
}
