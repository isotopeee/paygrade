/**
 * Pure selectors over the demo data. Pages call these with store state inside
 * `useMemo` so derived data is computed once per change.
 */

import { addMonths, parseISO } from "date-fns"

import type {
  Agency,
  Department,
  Employee,
  PayrollLine,
  PayrollRun,
  Remittance,
  RemittanceFiling,
  Role,
} from "@/types"
import { toISODate } from "@/lib/payroll/calendar"
import { REMITTANCE_DUE_DAY } from "@/lib/payroll/rates"
import { currentOwner } from "@/lib/workflow"

export function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]))
}

export function departmentName(departments: readonly Department[], id: string): string {
  return departments.find((d) => d.id === id)?.name ?? id
}

/** Runs waiting on the given role, most urgent (earliest pay date) first. */
export function pendingForRole(runs: readonly PayrollRun[], role: Role): PayrollRun[] {
  return runs
    .filter((r) => r.status !== "released" && currentOwner(r.status) === role)
    .sort((a, b) => a.payDate.localeCompare(b.payDate))
}

/** Latest regular runs with lines, newest first. */
export function regularRuns(runs: readonly PayrollRun[]): PayrollRun[] {
  return runs
    .filter((r) => r.type === "regular")
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart) || a.group.localeCompare(b.group))
}

/** Payslip history for an employee across all runs that have lines, newest first. */
export function payslipsFor(runs: readonly PayrollRun[], employeeId: string): { run: PayrollRun; line: PayrollLine }[] {
  const result: { run: PayrollRun; line: PayrollLine }[] = []
  for (const run of runs) {
    const line = run.lines.find((l) => l.employeeId === employeeId)
    if (line) result.push({ run, line })
  }
  return result.sort((a, b) => b.run.payDate.localeCompare(a.run.payDate))
}

/** Year-to-date totals for an employee up to and including a pay date. */
export function ytdFor(
  runs: readonly PayrollRun[],
  employeeId: string,
  upTo: string
): { gross: number; deductions: number; net: number; tax: number; gsis: number; philhealth: number; pagibig: number } {
  const year = upTo.slice(0, 4)
  const totals = { gross: 0, deductions: 0, net: 0, tax: 0, gsis: 0, philhealth: 0, pagibig: 0 }
  for (const run of runs) {
    if (run.status === "draft") continue
    if (run.payDate.slice(0, 4) !== year || run.payDate > upTo) continue
    const line = run.lines.find((l) => l.employeeId === employeeId)
    if (!line) continue
    totals.gross += line.gross
    totals.deductions += line.totalDeductions
    totals.net += line.net
    totals.tax += line.withholdingTax
    totals.gsis += line.gsis
    totals.philhealth += line.philhealth
    totals.pagibig += line.pagibig
  }
  return totals
}

/* ------------------------------------------------------------------ */
/* Remittances                                                         */
/* ------------------------------------------------------------------ */

export const AGENCIES: Agency[] = ["gsis", "philhealth", "pagibig", "bir"]

export function remittanceKey(agency: Agency, month: string): string {
  return `${agency}:${month}`
}

function sharesFor(agency: Agency, line: PayrollLine): { employee: number; government: number } {
  switch (agency) {
    case "gsis":
      return { employee: line.gsis, government: line.gsisGovernment + line.ecc }
    case "philhealth":
      return { employee: line.philhealth, government: line.philhealthGovernment }
    case "pagibig":
      return { employee: line.pagibig, government: line.pagibigGovernment }
    case "bir":
      return { employee: line.withholdingTax, government: 0 }
  }
}

/**
 * Monthly remittances derived from payroll runs (every non-draft run whose pay
 * date falls in the month), merged with the filing status kept in the store.
 */
export function deriveRemittances(
  runs: readonly PayrollRun[],
  filings: Record<string, RemittanceFiling>
): Remittance[] {
  const months = new Set<string>()
  for (const key of Object.keys(filings)) months.add(key.split(":")[1] ?? "")
  const result: Remittance[] = []
  for (const month of Array.from(months).filter(Boolean).sort()) {
    const monthRuns = runs.filter((r) => r.status !== "draft" && r.payDate.slice(0, 7) === month.slice(0, 7))
    for (const agency of AGENCIES) {
      let employee = 0
      let government = 0
      const heads = new Set<string>()
      for (const run of monthRuns) {
        for (const line of run.lines) {
          const s = sharesFor(agency, line)
          if (s.employee + s.government > 0) heads.add(line.employeeId)
          employee += s.employee
          government += s.government
        }
      }
      const due = addMonths(parseISO(month), 1)
      due.setDate(REMITTANCE_DUE_DAY[agency])
      const filing = filings[remittanceKey(agency, month)] ?? { status: "pending" as const }
      result.push({
        id: remittanceKey(agency, month),
        agency,
        month,
        employeeShare: employee,
        governmentShare: government,
        headcount: heads.size,
        dueDate: toISODate(due),
        status: filing.status,
        referenceNo: filing.referenceNo,
        filedAt: filing.filedAt,
        paidAt: filing.paidAt,
      })
    }
  }
  return result
}

/** Per-employee remittance schedule rows for one agency and month. */
export function remittanceSchedule(
  runs: readonly PayrollRun[],
  employees: readonly Employee[],
  agency: Agency,
  month: string
): { employee: Employee; employeeShare: number; governmentShare: number; basis: number }[] {
  const byEmployee = new Map<string, { employeeShare: number; governmentShare: number; basis: number }>()
  for (const run of runs) {
    if (run.status === "draft" || run.payDate.slice(0, 7) !== month.slice(0, 7)) continue
    for (const line of run.lines) {
      const s = sharesFor(agency, line)
      if (s.employee + s.government === 0) continue
      const current = byEmployee.get(line.employeeId) ?? { employeeShare: 0, governmentShare: 0, basis: 0 }
      current.employeeShare += s.employee
      current.governmentShare += s.government
      current.basis = agency === "bir" ? current.basis + line.taxableIncome : line.monthlyRate
      byEmployee.set(line.employeeId, current)
    }
  }
  const map = byId(employees)
  return Array.from(byEmployee.entries())
    .map(([id, v]) => ({ employee: map.get(id), ...v }))
    .filter((r): r is { employee: Employee; employeeShare: number; governmentShare: number; basis: number } => !!r.employee)
    .sort((a, b) => a.employee.lastName.localeCompare(b.employee.lastName))
}
