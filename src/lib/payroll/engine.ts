/**
 * Run engine: resolves employees, rates, salary schedules, DTR, and loans for a
 * payroll run and delegates the arithmetic to the pure functions in
 * `compute.ts`. Used by the seed generator and by the zustand data store.
 */

import { endOfMonth, parseISO } from "date-fns"

import type {
  Adjustment,
  AllowanceType,
  DtrSummary,
  Employee,
  EmployeeGroup,
  Loan,
  PayrollLine,
  PayrollPeriod,
  PayrollRun,
  RatesConfig,
  SalarySchedule,
  SpecialPayrollKind,
} from "@/types"
import { groupOf } from "@/lib/constants"

import { toISODate, workingDaysBetween } from "./calendar"
import {
  computePayrollLine,
  computeSpecialLine,
  daysRequiredInPeriod,
  isEligibleForSpecial,
  monthlyRateFor,
} from "./compute"
import { ratesForDate } from "./rates"

export interface EngineData {
  employees: readonly Employee[]
  salarySchedules: readonly SalarySchedule[]
  ratesVersions: readonly RatesConfig[]
  allowanceTypes: readonly AllowanceType[]
  dtr: readonly DtrSummary[]
  loans: readonly Loan[]
  periods: readonly PayrollPeriod[]
}

export function scheduleForDate(schedules: readonly SalarySchedule[], date: string): SalarySchedule {
  const sorted = [...schedules].sort((a, b) => a.effectivityDate.localeCompare(b.effectivityDate))
  let current = sorted[0]
  for (const s of sorted) if (s.effectivityDate <= date) current = s
  if (!current) throw new Error("No salary schedule available")
  return current
}

export function dtrKey(periodId: string, employeeId: string): string {
  return `${periodId}:${employeeId}`
}

export function indexDtr(dtr: readonly DtrSummary[]): Map<string, DtrSummary> {
  const map = new Map<string, DtrSummary>()
  for (const d of dtr) map.set(dtrKey(d.periodId, d.employeeId), d)
  return map
}

/** Was the employee in service at any point in the date range? */
export function inServiceDuring(employee: Employee, start: string, end: string): boolean {
  if (employee.dateHired > end) return false
  if (employee.separationDate && employee.separationDate < start) return false
  return true
}

export function employeesForPeriod(
  employees: readonly Employee[],
  group: EmployeeGroup,
  start: string,
  end: string
): Employee[] {
  return employees.filter(
    (e) => groupOf(e.employmentType) === group && e.status !== "suspended" && inServiceDuring(e, start, end)
  )
}

/** Monthly salary or monthly equivalent of an employee on a date. */
export function monthlyRateOn(data: Pick<EngineData, "salarySchedules" | "ratesVersions">, employee: Employee, date: string) {
  const schedule = scheduleForDate(data.salarySchedules, date)
  const rates = ratesForDate(data.ratesVersions, date)
  return monthlyRateFor(employee, schedule, rates)
}

/* ------------------------------------------------------------------ */
/* Exceptions for the Create Run wizard                                */
/* ------------------------------------------------------------------ */

export interface RunExceptions {
  missingDtr: Employee[]
  newHires: Employee[]
  separations: Employee[]
  onLeave: Employee[]
  suspended: Employee[]
}

export function findRunExceptions(data: EngineData, group: EmployeeGroup, period: PayrollPeriod): RunExceptions {
  const index = indexDtr(data.dtr)
  const included = employeesForPeriod(data.employees, group, period.start, period.end)
  return {
    missingDtr: included.filter((e) => !index.has(dtrKey(period.id, e.id))),
    newHires: included.filter((e) => e.dateHired >= period.start && e.dateHired <= period.end),
    separations: included.filter(
      (e) => e.separationDate !== undefined && e.separationDate >= period.start && e.separationDate <= period.end
    ),
    onLeave: included.filter((e) => e.status === "on_leave"),
    suspended: data.employees.filter(
      (e) => groupOf(e.employmentType) === group && e.status === "suspended" && inServiceDuring(e, period.start, period.end)
    ),
  }
}

/* ------------------------------------------------------------------ */
/* Regular runs                                                        */
/* ------------------------------------------------------------------ */

export function computeRegularLines(
  data: EngineData,
  run: Pick<PayrollRun, "periodId" | "employeeIds" | "periodStart">,
  adjustments: readonly Adjustment[]
): PayrollLine[] {
  const period = data.periods.find((p) => p.id === run.periodId)
  if (!period) throw new Error(`Unknown period ${run.periodId}`)
  const rates = ratesForDate(data.ratesVersions, period.start)
  const schedule = scheduleForDate(data.salarySchedules, period.start)
  const index = indexDtr(data.dtr)
  const employeesById = new Map(data.employees.map((e) => [e.id, e]))

  const lines: PayrollLine[] = []
  for (const id of run.employeeIds) {
    const employee = employeesById.get(id)
    if (!employee) continue
    lines.push(
      computePayrollLine({
        employee,
        monthlyRate: monthlyRateFor(employee, schedule, rates),
        period,
        dtr: index.get(dtrKey(period.id, id)),
        loans: data.loans.filter((l) => l.employeeId === id),
        adjustments,
        allowanceTypes: data.allowanceTypes,
        rates,
      })
    )
  }
  return lines.sort((a, b) => a.employeeName.localeCompare(b.employeeName))
}

/* ------------------------------------------------------------------ */
/* Special runs                                                        */
/* ------------------------------------------------------------------ */

/** Reference date used for eligibility and salary rate of a special payroll. */
export function specialAsOf(kind: SpecialPayrollKind, periodStart: string, periodEnd: string): string {
  const year = periodStart.slice(0, 4)
  if (kind === "mid_year_bonus") return `${year}-05-15`
  if (kind === "year_end_bonus") return `${year}-10-31`
  return periodEnd
}

export function monthRange(month: string): { start: string; end: string } {
  const start = `${month.slice(0, 7)}-01`
  return { start, end: toISODate(endOfMonth(parseISO(start))) }
}

export interface SpecialEligibility {
  eligible: Employee[]
  ineligible: { employee: Employee; reason: string }[]
}

export function specialEligibility(
  data: EngineData,
  kind: SpecialPayrollKind,
  periodStart: string,
  periodEnd: string
): SpecialEligibility {
  const asOf = specialAsOf(kind, periodStart, periodEnd)
  const rates = ratesForDate(data.ratesVersions, asOf)
  const eligible: Employee[] = []
  const ineligible: { employee: Employee; reason: string }[] = []
  for (const employee of employeesForPeriod(data.employees, "plantilla", periodStart, periodEnd)) {
    const result = isEligibleForSpecial(kind, employee, asOf, rates)
    if (result.eligible) eligible.push(employee)
    else ineligible.push({ employee, reason: result.reason ?? "Not eligible" })
  }
  return { eligible, ineligible }
}

function daysInMonth(
  data: EngineData,
  index: Map<string, DtrSummary>,
  employee: Employee,
  start: string,
  end: string
) {
  const periods = data.periods.filter((p) => p.start >= start && p.end <= end)
  let worked = 0
  let required = 0
  for (const p of periods) {
    const d = index.get(dtrKey(p.id, employee.id))
    const req = d?.daysRequired ?? daysRequiredInPeriod(employee, p)
    required += req
    worked += d ? d.daysWorked + d.leaveWithPayDays : req
  }
  if (periods.length === 0) {
    required = workingDaysBetween(start, end)
    worked = required
  }
  return { worked, required }
}

export function computeSpecialLines(
  data: EngineData,
  run: Pick<PayrollRun, "specialKind" | "employeeIds" | "periodStart" | "periodEnd">,
  adjustments: readonly Adjustment[]
): PayrollLine[] {
  const kind = run.specialKind
  if (!kind) throw new Error("Special run without a kind")
  const asOf = specialAsOf(kind, run.periodStart, run.periodEnd)
  const rates = ratesForDate(data.ratesVersions, asOf)
  const schedule = scheduleForDate(data.salarySchedules, asOf)
  const employeesById = new Map(data.employees.map((e) => [e.id, e]))
  const index = indexDtr(data.dtr)

  const lines: PayrollLine[] = []
  for (const id of run.employeeIds) {
    const employee = employeesById.get(id)
    if (!employee) continue
    const { worked, required } = daysInMonth(data, index, employee, run.periodStart, run.periodEnd)
    lines.push(
      computeSpecialLine({
        kind,
        employee,
        monthlyRate: monthlyRateFor(employee, schedule, rates),
        asOf,
        daysWorked: worked,
        daysRequired: required,
        adjustments,
        rates,
      })
    )
  }
  return lines.sort((a, b) => a.employeeName.localeCompare(b.employeeName))
}

export function computeRunLines(
  data: EngineData,
  run: Pick<PayrollRun, "type" | "specialKind" | "periodId" | "employeeIds" | "periodStart" | "periodEnd">,
  adjustments: readonly Adjustment[]
): PayrollLine[] {
  return run.type === "special" ? computeSpecialLines(data, run, adjustments) : computeRegularLines(data, run, adjustments)
}
