"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeftIcon,
  CalendarCheckIcon,
  CalendarXIcon,
  ClockAlertIcon,
  FileUpIcon,
  HourglassIcon,
  MoonIcon,
  PencilIcon,
  PlaneIcon,
  PlusIcon,
  PrinterIcon,
  TimerIcon,
  UserXIcon,
} from "lucide-react"

import { buildDailyEntries } from "@/lib/attendance"
import { GROUP_LABELS, groupOf, HOSPITAL } from "@/lib/constants"
import { formatHours, formatPeriod, fullName, registerName } from "@/lib/format"
import { daysRequiredInPeriod } from "@/lib/payroll/compute"
import { dtrKey, indexDtr } from "@/lib/payroll/engine"
import { can } from "@/lib/permissions"
import { departmentName } from "@/lib/selectors"
import { CURRENT_PERIOD_ID } from "@/data/seed"
import { useDataStore } from "@/stores/data-store"
import { useRole } from "@/stores/session-store"
import { PageContainer, PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"

import { DailyRecordTable } from "./daily-record-table"
import { DtrEditDialog } from "./dtr-edit-dialog"
import { PeriodSelect, useDtrPeriods } from "./period-select"
import { DtrSourceBadge } from "./source-badge"

export function EmployeeDtr() {
  const params = useParams<{ employeeId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const role = useRole()
  const employees = useDataStore((s) => s.employees)
  const departments = useDataStore((s) => s.departments)
  const dtr = useDataStore((s) => s.dtr)
  const periods = useDtrPeriods()
  const canManage = can(role, "attendance.manage")
  const [editOpen, setEditOpen] = useState(false)

  const employeeId = params.employeeId
  const employee = employees.find((e) => e.id === employeeId)
  const requested = searchParams.get("period") ?? CURRENT_PERIOD_ID
  const period = periods.find((p) => p.id === requested) ?? periods.find((p) => p.id === CURRENT_PERIOD_ID) ?? periods[0]

  const summary = useMemo(
    () => (employee && period ? indexDtr(dtr).get(dtrKey(period.id, employee.id)) : undefined),
    [dtr, employee, period]
  )
  const entries = useMemo(
    () => (employee && period ? buildDailyEntries(employee, period, summary) : []),
    [employee, period, summary]
  )

  const backLink = (
    <Link
      href="/attendance"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground print:hidden"
    >
      <ArrowLeftIcon className="size-3.5" aria-hidden />
      Time and Attendance
    </Link>
  )

  if (!employee || !period) {
    return (
      <PageContainer>
        <PageHeader eyebrow={backLink} title="Employee not found" />
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserXIcon />
            </EmptyMedia>
            <EmptyTitle>No employee with this ID</EmptyTitle>
            <EmptyDescription>The record may have been removed, or the link is incorrect.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" render={<Link href="/attendance" />} nativeButton={false}>
              Back to attendance
            </Button>
          </EmptyContent>
        </Empty>
      </PageContainer>
    )
  }

  const inService = employee.dateHired <= period.end && (!employee.separationDate || employee.separationDate >= period.start)
  const daysRequired = summary?.daysRequired ?? daysRequiredInPeriod(employee, period)
  const dept = departmentName(departments, employee.departmentId)
  const periodLabel = formatPeriod(period.start, period.end)

  const setPeriod = (id: string) => router.replace(`/attendance/${employee.id}?period=${id}`, { scroll: false })

  return (
    <PageContainer className="print:max-w-none print:p-0">
      <PageHeader
        className="print:hidden"
        eyebrow={backLink}
        title={fullName(employee)}
        description={
          <>
            <span className="font-mono text-xs">{employee.employeeNo}</span>
            {" · "}
            {employee.positionTitle}
            {" · "}
            {dept}
            {" · "}
            {GROUP_LABELS[groupOf(employee.employmentType)]}
          </>
        }
        actions={
          <>
            <Field orientation="horizontal" className="w-auto">
              <FieldLabel htmlFor="dtr-period" className="sr-only">
                Payroll period
              </FieldLabel>
              <PeriodSelect value={period.id} onChange={setPeriod} />
            </Field>
            {summary && (
              <Button variant="outline" onClick={() => window.print()}>
                <PrinterIcon data-icon="inline-start" />
                Print DTR
              </Button>
            )}
            {canManage && summary && (
              <Button onClick={() => setEditOpen(true)}>
                <PencilIcon data-icon="inline-start" />
                Edit summary
              </Button>
            )}
          </>
        }
      />

      {/* Print header, CS Form No. 48 */}
      <div className="hidden space-y-1 text-center print:block">
        <p className="text-left text-xs italic">Civil Service Form No. 48</p>
        <p className="text-base font-bold tracking-wide">DAILY TIME RECORD</p>
        <p className="text-sm font-semibold underline underline-offset-4">{registerName(employee)}</p>
        <p className="text-xs">
          {employee.positionTitle}, {dept}
        </p>
        <p className="text-xs">
          For the period {periodLabel}. {HOSPITAL.name}
        </p>
        <p className="text-xs">Official hours for arrival and departure: 8:00 AM to 12:00 PM, 1:00 PM to 5:00 PM</p>
      </div>

      {!summary ? (
        <Empty className="border print:hidden">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {inService ? <CalendarXIcon /> : <UserXIcon />}
            </EmptyMedia>
            <EmptyTitle>{inService ? "No DTR for this period" : "Not in service during this period"}</EmptyTitle>
            <EmptyDescription>
              {inService
                ? `No biometric logs were recorded for ${periodLabel}. Import the biometric export from the Time and Attendance page${canManage ? " or create a manual entry" : ""}. Payroll treats a missing DTR as an exception.`
                : `${fullName(employee)} was not employed from ${periodLabel}. Select another period.`}
            </EmptyDescription>
          </EmptyHeader>
          {inService && (
            <EmptyContent>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" render={<Link href="/attendance" />} nativeButton={false}>
                  <FileUpIcon data-icon="inline-start" />
                  Go to import
                </Button>
                {canManage && (
                  <Button onClick={() => setEditOpen(true)}>
                    <PlusIcon data-icon="inline-start" />
                    Create manual entry
                  </Button>
                )}
              </div>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7 print:hidden">
            <StatCard label="Days worked" value={summary.daysWorked} icon={CalendarCheckIcon} hint={`of ${daysRequired} required`} />
            <StatCard label="Leave with pay" value={summary.leaveWithPayDays} icon={PlaneIcon} hint="Days" />
            <StatCard label="Absences (LWOP)" value={summary.absencesWithoutPay} icon={CalendarXIcon} hint="Days without pay" />
            <StatCard label="Tardiness" value={summary.tardinessMinutes} icon={ClockAlertIcon} hint="Minutes" />
            <StatCard label="Undertime" value={summary.undertimeMinutes} icon={HourglassIcon} hint="Minutes" />
            <StatCard
              label="Overtime"
              value={formatHours(summary.overtimeHoursRegular + summary.overtimeHoursRestDay)}
              icon={TimerIcon}
              hint={`${formatHours(summary.overtimeHoursRegular)} h regular, ${formatHours(summary.overtimeHoursRestDay)} h rest day`}
            />
            <StatCard label="Night differential" value={formatHours(summary.nightDiffHours)} icon={MoonIcon} hint="Hours" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
            <div>
              <h2 className="text-sm font-semibold">Daily time record</h2>
              <p className="text-xs text-muted-foreground">
                {periodLabel}. Daily punches reconstructed from the period summary for display.
              </p>
            </div>
            <DtrSourceBadge source={summary.source} />
          </div>

          <DailyRecordTable entries={entries} />

          <div className="hidden grid-cols-2 gap-12 pt-10 text-xs print:grid">
            <div className="space-y-8">
              <p>
                I certify on my honor that the above is a true and correct report of the hours of work performed, record of
                which was made daily at the time of arrival and departure from office.
              </p>
              <div className="border-t border-foreground pt-1 text-center">{fullName(employee)}</div>
            </div>
            <div className="space-y-8">
              <p>Verified as to the prescribed office hours.</p>
              <div className="border-t border-foreground pt-1 text-center">In charge</div>
            </div>
          </div>
        </>
      )}

      {canManage && (
        <DtrEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          employee={employee}
          period={period}
          summary={summary}
          daysRequired={daysRequired}
        />
      )}
    </PageContainer>
  )
}
