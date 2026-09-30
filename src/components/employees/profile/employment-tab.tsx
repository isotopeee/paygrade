"use client"

import { differenceInCalendarDays, parseISO } from "date-fns"
import { AlertCircleIcon, CalendarClockIcon, CheckIcon } from "lucide-react"

import type { Employee } from "@/types"
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/constants"
import { stepIncrementInfo, yearsOfService } from "@/lib/employees"
import { formatCurrency, formatDate, formatPercent } from "@/lib/format"
import { departmentName } from "@/lib/selectors"
import { useDataStore } from "@/stores/data-store"
import { DEMO_TODAY } from "@/data/seed"
import { InfoGrid, type InfoItem } from "@/components/info-grid"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { useEmployeeRates } from "./use-employee-rates"

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

function StepIncrementDue({ employee }: { employee: Employee }) {
  const info = stepIncrementInfo(employee, DEMO_TODAY)
  if (info.maxed) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <CheckIcon className="size-3.5" aria-hidden />
        Maximum step reached
      </span>
    )
  }
  const days = info.daysUntil ?? 0
  const text = days < 0 ? `Overdue by ${plural(-days, "day")}` : days === 0 ? "Due today" : `Due in ${plural(days, "day")}`
  const Icon = days < 0 ? AlertCircleIcon : CalendarClockIcon
  return (
    <span className="inline-flex items-center gap-1.5">
      {info.attention && <Icon className="size-3.5 shrink-0" aria-hidden />}
      <span className={info.attention ? "font-medium" : undefined}>{text}</span>
      {info.dueDate && <span className="text-muted-foreground">({formatDate(info.dueDate)})</span>}
    </span>
  )
}

export function EmploymentTab({ employee }: { employee: Employee }) {
  const departments = useDataStore((s) => s.departments)
  const { rates, schedule, monthlyRate, plantilla } = useEmployeeRates(employee)
  const years = yearsOfService(employee.dateHired, employee.separationDate ?? DEMO_TODAY)

  const common: InfoItem[] = [
    { label: "Position", value: employee.positionTitle },
    { label: "Department", value: departmentName(departments, employee.departmentId) },
    { label: "Employment type", value: EMPLOYMENT_TYPE_LABELS[employee.employmentType] },
    { label: "Date hired", value: formatDate(employee.dateHired) },
    { label: "Years in service", value: plural(years, "year") },
  ]
  if (employee.separationDate) common.push({ label: "Separation date", value: formatDate(employee.separationDate) })

  if (plantilla) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Appointment</CardTitle>
          <CardDescription>Plantilla position, salary grade, and step increment schedule.</CardDescription>
        </CardHeader>
        <CardContent>
          <InfoGrid
            columns={3}
            items={[
              ...common,
              ...(employee.employmentType === "permanent"
                ? [{ label: "Plantilla item no.", value: employee.itemNo, mono: true }]
                : []),
              { label: "Salary grade and step", value: `SG ${employee.salaryGrade ?? 1}, Step ${employee.step ?? 1}` },
              { label: "Monthly basic salary", value: <span className="font-medium tabular-nums">{formatCurrency(monthlyRate)}</span> },
              { label: "Salary schedule in force", value: schedule.name, span: 2 },
              {
                label: "Last step increment",
                value: employee.lastStepIncrement ? formatDate(employee.lastStepIncrement) : "None since hiring",
              },
              { label: "Next step increment", value: <StepIncrementDue employee={employee} />, span: 2 },
            ]}
          />
        </CardContent>
      </Card>
    )
  }

  const daily = employee.rateType === "daily"
  const contractDays = employee.contractEnd
    ? differenceInCalendarDays(parseISO(employee.contractEnd), parseISO(DEMO_TODAY))
    : undefined
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract</CardTitle>
        <CardDescription>
          {daily ? "Job Order, paid for days actually worked." : "Contract of Service, paid a fixed monthly rate."} No
          employer-employee relationship under CSC rules.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InfoGrid
          columns={3}
          items={[
            ...common,
            { label: "Rate type", value: daily ? "Daily rate" : "Monthly rate" },
            {
              label: "Contract rate",
              value: <span className="font-medium tabular-nums">{`${formatCurrency(employee.contractRate ?? 0)} / ${daily ? "day" : "month"}`}</span>,
            },
            {
              label: "Monthly equivalent",
              value: (
                <span className="tabular-nums">
                  {formatCurrency(monthlyRate)}
                  {daily && <span className="text-muted-foreground"> ({rates.workingDaysPerMonth} working days)</span>}
                </span>
              ),
            },
            {
              label: "Contract end",
              value: employee.contractEnd ? (
                <span>
                  {formatDate(employee.contractEnd)}
                  {contractDays !== undefined && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({contractDays < 0 ? `ended ${plural(-contractDays, "day")} ago` : `${plural(contractDays, "day")} left`})
                    </span>
                  )}
                </span>
              ) : undefined,
            },
            { label: "Sworn declaration on file", value: employee.swornDeclaration ? "Yes" : "No" },
            {
              label: "Tax effect",
              value: employee.swornDeclaration
                ? "No tax withheld (income within the exemption threshold)"
                : `${formatPercent(rates.joCos.withholdingRate)} flat withholding on gross pay`,
              span: 2,
            },
          ]}
        />
      </CardContent>
    </Card>
  )
}
