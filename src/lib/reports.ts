/**
 * Pure row builders for the Reports module. No function here reads global
 * state; pages pass store data in and render the result. Amounts are integer
 * centavos.
 */

import type {
  AllowanceType,
  Centavos,
  Department,
  Employee,
  EmployeeGroup,
  LeaveCredit,
  PayrollLine,
  PayrollRun,
  RatesConfig,
  SalarySchedule,
} from "@/types"
import { groupOf } from "@/lib/constants"
import { computeWithholdingTax } from "@/lib/payroll/compute"
import { monthlyRateOn } from "@/lib/payroll/engine"
import { prorate } from "@/lib/payroll/money"
import { ratesForDate, SEED_RATES } from "@/lib/payroll/rates"

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export type ReportSlug =
  | "general-payroll"
  | "payroll-register"
  | "summary-by-department"
  | "bir-2316"
  | "alphalist"
  | "leave-monetization"

export interface ReportMeta {
  slug: ReportSlug
  name: string
  description: string
  reference: string
}

export const REPORTS: ReportMeta[] = [
  {
    slug: "general-payroll",
    name: "General Payroll",
    description: "Signed payroll sheet per regular run with earnings, deductions, net pay, and certifications.",
    reference: "COA General Payroll form (Appendix 33, GAM for NGAs)",
  },
  {
    slug: "payroll-register",
    name: "Payroll Register",
    description: "Full register of a run including government shares and total personnel services cost.",
    reference: "COA Circular 2012-001; DBM PS cost reporting",
  },
  {
    slug: "summary-by-department",
    name: "Payroll Summary by Department",
    description: "Monthly headcount, gross, deductions, net, and PS cost rolled up per cost center.",
    reference: "Internal management report for Budget and Accounting",
  },
  {
    slug: "bir-2316",
    name: "BIR Form 2316",
    description: "Certificate of Compensation Payment or Tax Withheld per employee, year to date.",
    reference: "BIR Form 2316 (January 2018 ENCS); RR 11-2018",
  },
  {
    slug: "alphalist",
    name: "Alphalist of Employees",
    description: "Annual list of employees with gross, non-taxable, and taxable compensation and tax withheld.",
    reference: "BIR Form 1604-C, Schedule 1; RR 2-2015",
  },
  {
    slug: "leave-monetization",
    name: "Leave Monetization",
    description: "Monetizable vacation leave credits and computed amounts for plantilla personnel.",
    reference: "CSC Omnibus Rules on Leave (MC 41, s. 1998); DBM guidelines",
  },
]

export function reportBySlug(slug: string): ReportMeta | undefined {
  return REPORTS.find((r) => r.slug === slug)
}

/* ------------------------------------------------------------------ */
/* Tax treatment constants (seed values, not yet in RatesConfig)       */
/* ------------------------------------------------------------------ */

/**
 * Default annual exemption ceiling for 13th month pay and other benefits under
 * TRAIN (RA 10963), from the seed rates. Builders use the ceiling of the rates
 * version in force for the report date.
 */
export const BONUS_EXEMPTION_CEILING: Centavos = SEED_RATES[SEED_RATES.length - 1]?.bonuses.exemptionCeiling ?? 0

/** Special payroll earning codes treated as 13th month and other benefits. */
export const BONUS_CODES = new Set(["MYB", "YEB", "CG", "PEI"])

/** Special payroll earning codes treated as de minimis benefits (non-taxable). */
export const DE_MINIMIS_CODES = new Set(["SA", "LA", "UA"])

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function sumOf<T>(items: readonly T[], pick: (item: T) => number): number {
  let total = 0
  for (const item of items) total += pick(item)
  return total
}

/** Non-draft runs, newest pay date first. */
export function reportableRuns(runs: readonly PayrollRun[], options: { regularOnly?: boolean } = {}): PayrollRun[] {
  return runs
    .filter((r) => r.status !== "draft" && r.lines.length > 0 && (!options.regularOnly || r.type === "regular"))
    .sort((a, b) => b.payDate.localeCompare(a.payDate) || b.group.localeCompare(a.group))
}

export function employerShares(line: PayrollLine): Centavos {
  return line.gsisGovernment + line.ecc + line.philhealthGovernment + line.pagibigGovernment
}

export function rateLabel(employee: Employee | undefined, line: PayrollLine): string {
  if (employee?.rateType === "salary_grade") return `SG ${employee.salaryGrade ?? "?"}-${employee.step ?? 1}`
  if (employee?.rateType === "daily" && employee.contractRate !== undefined) {
    return `${(employee.contractRate / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}/day`
  }
  return line.group === "jo_cos" ? "Monthly contract" : "Monthly"
}

/* ------------------------------------------------------------------ */
/* General Payroll                                                     */
/* ------------------------------------------------------------------ */

export interface GeneralPayrollRow {
  no: number
  employeeId: string
  employeeNo: string
  name: string
  position: string
  rate: string
  monthlyRate: Centavos
  basic: Centavos
  pera: Centavos
  /** Allowances, overtime, night differential, and other earnings. */
  allowances: Centavos
  gross: Centavos
  gsis: Centavos
  philhealth: Centavos
  pagibig: Centavos
  tax: Centavos
  loans: Centavos
  other: Centavos
  totalDeductions: Centavos
  net: Centavos
}

export function buildGeneralPayroll(run: PayrollRun, employees: readonly Employee[]): GeneralPayrollRow[] {
  const byId = new Map(employees.map((e) => [e.id, e]))
  return [...run.lines]
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
    .map((line, i) => ({
      no: i + 1,
      employeeId: line.employeeId,
      employeeNo: line.employeeNo,
      name: line.employeeName,
      position: line.positionTitle,
      rate: rateLabel(byId.get(line.employeeId), line),
      monthlyRate: line.monthlyRate,
      basic: line.basic,
      pera: line.pera,
      allowances: line.gross - line.basic - line.pera,
      gross: line.gross,
      gsis: line.gsis,
      philhealth: line.philhealth,
      pagibig: line.pagibig,
      tax: line.withholdingTax,
      loans: line.loansTotal,
      other: line.otherDeductionsTotal,
      totalDeductions: line.totalDeductions,
      net: line.net,
    }))
}

/* ------------------------------------------------------------------ */
/* Payroll Register                                                    */
/* ------------------------------------------------------------------ */

export interface RegisterRow {
  employeeId: string
  employeeNo: string
  name: string
  department: string
  position: string
  basic: Centavos
  pera: Centavos
  allowances: Centavos
  overtime: Centavos
  gross: Centavos
  gsis: Centavos
  philhealth: Centavos
  pagibig: Centavos
  tax: Centavos
  loans: Centavos
  other: Centavos
  totalDeductions: Centavos
  net: Centavos
  gsisGovernment: Centavos
  ecc: Centavos
  philhealthGovernment: Centavos
  pagibigGovernment: Centavos
  employerShares: Centavos
  psCost: Centavos
}

export function buildRegister(run: PayrollRun, departments: readonly Department[]): RegisterRow[] {
  const deptName = new Map(departments.map((d) => [d.id, d.name]))
  return [...run.lines]
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
    .map((line) => {
      const shares = employerShares(line)
      const otherEarnings = sumOf(line.otherEarnings, (e) => e.amount)
      return {
        employeeId: line.employeeId,
        employeeNo: line.employeeNo,
        name: line.employeeName,
        department: deptName.get(line.departmentId) ?? line.departmentId,
        position: line.positionTitle,
        basic: line.basic,
        pera: line.pera,
        allowances: line.allowancesTotal + otherEarnings,
        overtime: line.overtime + line.nightDiff,
        gross: line.gross,
        gsis: line.gsis,
        philhealth: line.philhealth,
        pagibig: line.pagibig,
        tax: line.withholdingTax,
        loans: line.loansTotal,
        other: line.otherDeductionsTotal,
        totalDeductions: line.totalDeductions,
        net: line.net,
        gsisGovernment: line.gsisGovernment,
        ecc: line.ecc,
        philhealthGovernment: line.philhealthGovernment,
        pagibigGovernment: line.pagibigGovernment,
        employerShares: shares,
        psCost: line.gross + shares,
      }
    })
}

/* ------------------------------------------------------------------ */
/* Summary by Department                                               */
/* ------------------------------------------------------------------ */

export type GroupFilter = "all" | EmployeeGroup

export interface DepartmentSummaryRow {
  departmentId: string
  code: string
  name: string
  costCenter: string
  headcount: number
  gross: Centavos
  totalDeductions: Centavos
  net: Centavos
  employerShares: Centavos
  psCost: Centavos
}

/** Months (`yyyy-MM`) that have at least one non-draft run, newest first. */
export function runMonths(runs: readonly PayrollRun[]): string[] {
  const months = new Set<string>()
  for (const r of runs) if (r.status !== "draft" && r.lines.length > 0) months.add(r.payDate.slice(0, 7))
  return Array.from(months).sort().reverse()
}

export function buildDepartmentSummary(
  runs: readonly PayrollRun[],
  departments: readonly Department[],
  month: string,
  group: GroupFilter
): DepartmentSummaryRow[] {
  const rows = new Map<string, DepartmentSummaryRow & { heads: Set<string> }>()
  for (const run of runs) {
    if (run.status === "draft" || run.payDate.slice(0, 7) !== month) continue
    for (const line of run.lines) {
      if (group !== "all" && line.group !== group) continue
      let row = rows.get(line.departmentId)
      if (!row) {
        const dept = departments.find((d) => d.id === line.departmentId)
        row = {
          departmentId: line.departmentId,
          code: dept?.code ?? "",
          name: dept?.name ?? line.departmentId,
          costCenter: dept?.costCenter ?? "",
          headcount: 0,
          gross: 0,
          totalDeductions: 0,
          net: 0,
          employerShares: 0,
          psCost: 0,
          heads: new Set(),
        }
        rows.set(line.departmentId, row)
      }
      const shares = employerShares(line)
      row.heads.add(line.employeeId)
      row.gross += line.gross
      row.totalDeductions += line.totalDeductions
      row.net += line.net
      row.employerShares += shares
      row.psCost += line.gross + shares
    }
  }
  return Array.from(rows.values())
    .map(({ heads, ...row }) => ({ ...row, headcount: heads.size }))
    .sort((a, b) => b.net - a.net)
}

/* ------------------------------------------------------------------ */
/* Compensation classification (BIR 2316 and Alphalist)                */
/* ------------------------------------------------------------------ */

export interface CompensationBreakdown {
  gross: Centavos
  basic: Centavos
  pera: Centavos
  nonTaxableAllowances: Centavos
  deMinimis: Centavos
  /** 13th month pay and other benefits (before applying the ceiling). */
  bonuses: Centavos
  taxableAllowances: Centavos
  /** Overtime, night differential, and manual earnings. */
  otherTaxable: Centavos
  contributions: Centavos
  taxWithheld: Centavos
}

export const EMPTY_BREAKDOWN: CompensationBreakdown = {
  gross: 0,
  basic: 0,
  pera: 0,
  nonTaxableAllowances: 0,
  deMinimis: 0,
  bonuses: 0,
  taxableAllowances: 0,
  otherTaxable: 0,
  contributions: 0,
  taxWithheld: 0,
}

export function addBreakdown(a: CompensationBreakdown, b: CompensationBreakdown): CompensationBreakdown {
  return {
    gross: a.gross + b.gross,
    basic: a.basic + b.basic,
    pera: a.pera + b.pera,
    nonTaxableAllowances: a.nonTaxableAllowances + b.nonTaxableAllowances,
    deMinimis: a.deMinimis + b.deMinimis,
    bonuses: a.bonuses + b.bonuses,
    taxableAllowances: a.taxableAllowances + b.taxableAllowances,
    otherTaxable: a.otherTaxable + b.otherTaxable,
    contributions: a.contributions + b.contributions,
    taxWithheld: a.taxWithheld + b.taxWithheld,
  }
}

/** Classify one payroll line into BIR compensation buckets. */
export function classifyLine(line: PayrollLine, allowanceTypes: readonly AllowanceType[]): CompensationBreakdown {
  const taxableByCode = new Map(allowanceTypes.map((a) => [a.code, a.taxable]))
  const result: CompensationBreakdown = { ...EMPTY_BREAKDOWN }
  result.gross = line.gross
  result.basic = line.basic
  result.pera = line.pera
  for (const item of line.allowances) {
    if (BONUS_CODES.has(item.code)) result.bonuses += item.amount
    else if (DE_MINIMIS_CODES.has(item.code)) result.deMinimis += item.amount
    else if (taxableByCode.get(item.code) === false) result.nonTaxableAllowances += item.amount
    else result.taxableAllowances += item.amount
  }
  result.otherTaxable = line.overtime + line.nightDiff + sumOf(line.otherEarnings, (e) => e.amount)
  result.contributions = line.gsis + line.philhealth + line.pagibig
  result.taxWithheld = line.withholdingTax
  return result
}

export interface TaxSummary {
  exemptBonuses: Centavos
  taxableBonuses: Centavos
  nonTaxable: Centavos
  taxable: Centavos
}

/** Split a breakdown into non-taxable and taxable totals, applying the bonus ceiling. */
export function summarizeTax(b: CompensationBreakdown, ceiling: Centavos = BONUS_EXEMPTION_CEILING): TaxSummary {
  const exemptBonuses = Math.min(b.bonuses, ceiling)
  const taxableBonuses = b.bonuses - exemptBonuses
  const nonTaxable = b.pera + b.nonTaxableAllowances + b.deMinimis + exemptBonuses + b.contributions
  return { exemptBonuses, taxableBonuses, nonTaxable, taxable: b.gross - nonTaxable }
}

function linesInYear(runs: readonly PayrollRun[], year: string, asOf: string) {
  const result: { run: PayrollRun; line: PayrollLine }[] = []
  for (const run of runs) {
    if (run.status === "draft" || run.payDate.slice(0, 4) !== year || run.payDate > asOf) continue
    for (const line of run.lines) result.push({ run, line })
  }
  return result
}

/* ------------------------------------------------------------------ */
/* BIR Form 2316                                                       */
/* ------------------------------------------------------------------ */

export interface MonthlyCompensationRow {
  month: string
  gross: Centavos
  nonTaxable: Centavos
  taxable: Centavos
  taxWithheld: Centavos
}

export interface Form2316 {
  employee: Employee
  year: string
  asOf: string
  /** Exemption ceiling for 13th month pay and other benefits from the rates version in force. */
  exemptionCeiling: Centavos
  breakdown: CompensationBreakdown
  tax: TaxSummary
  /** Regular monthly payrolls paid year to date. */
  monthsPaid: number
  projectedAnnualTaxable: Centavos
  annualTaxDue: Centavos
  taxDueToDate: Centavos
  taxWithheld: Centavos
  /** Positive: over-withheld to date. Negative: under-withheld to date. */
  difference: Centavos
  remainingForYear: Centavos
  monthly: MonthlyCompensationRow[]
}

/**
 * Year-to-date 2316 figures with a projected annualization: taxable pay from
 * regular runs is extrapolated to 12 months, taxable bonuses are added as is,
 * and the annual BIR table is applied.
 */
export function buildForm2316(input: {
  employee: Employee
  runs: readonly PayrollRun[]
  allowanceTypes: readonly AllowanceType[]
  ratesVersions: readonly RatesConfig[]
  year: string
  asOf: string
}): Form2316 {
  const { employee, allowanceTypes, year, asOf } = input
  const entries = linesInYear(input.runs, year, asOf).filter((e) => e.line.employeeId === employee.id)

  let breakdown = EMPTY_BREAKDOWN
  let regular = EMPTY_BREAKDOWN
  let monthsPaid = 0
  const byMonth = new Map<string, CompensationBreakdown>()
  for (const { run, line } of entries) {
    const b = classifyLine(line, allowanceTypes)
    breakdown = addBreakdown(breakdown, b)
    if (run.type === "regular") {
      regular = addBreakdown(regular, b)
      monthsPaid += 1
    }
    const month = run.payDate.slice(0, 7)
    byMonth.set(month, addBreakdown(byMonth.get(month) ?? EMPTY_BREAKDOWN, b))
  }

  const rates = ratesForDate(input.ratesVersions, asOf)
  const ceiling = rates.bonuses.exemptionCeiling
  const tax = summarizeTax(breakdown, ceiling)
  const regularTaxable = summarizeTax({ ...regular, bonuses: 0 }, ceiling).taxable
  const projectedRegular = monthsPaid > 0 ? prorate(regularTaxable, 12, monthsPaid) : 0
  const projectedAnnualTaxable = Math.max(0, projectedRegular + (tax.taxable - regularTaxable))
  const annualTaxDue = computeWithholdingTax(projectedAnnualTaxable, rates.withholding.annual)
  const taxDueToDate = prorate(annualTaxDue, Math.min(monthsPaid, 12), 12)
  const taxWithheld = breakdown.taxWithheld

  const monthly = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => {
      const s = summarizeTax(b, ceiling)
      return { month, gross: b.gross, nonTaxable: s.nonTaxable, taxable: s.taxable, taxWithheld: b.taxWithheld }
    })

  return {
    employee,
    year,
    asOf,
    exemptionCeiling: ceiling,
    breakdown,
    tax,
    monthsPaid,
    projectedAnnualTaxable,
    annualTaxDue,
    taxDueToDate,
    taxWithheld,
    difference: taxWithheld - taxDueToDate,
    remainingForYear: Math.max(0, annualTaxDue - taxWithheld),
    monthly,
  }
}

/* ------------------------------------------------------------------ */
/* Alphalist                                                           */
/* ------------------------------------------------------------------ */

export interface AlphalistRow {
  employeeId: string
  tin: string
  lastName: string
  firstName: string
  middleName: string
  group: EmployeeGroup
  gross: Centavos
  nonTaxable: Centavos
  taxable: Centavos
  taxWithheld: Centavos
}

export function buildAlphalist(input: {
  employees: readonly Employee[]
  runs: readonly PayrollRun[]
  allowanceTypes: readonly AllowanceType[]
  year: string
  asOf: string
}): AlphalistRow[] {
  const totals = new Map<string, CompensationBreakdown>()
  for (const { line } of linesInYear(input.runs, input.year, input.asOf)) {
    totals.set(line.employeeId, addBreakdown(totals.get(line.employeeId) ?? EMPTY_BREAKDOWN, classifyLine(line, input.allowanceTypes)))
  }
  const rows: AlphalistRow[] = []
  for (const employee of input.employees) {
    const b = totals.get(employee.id)
    if (!b) continue
    const s = summarizeTax(b)
    rows.push({
      employeeId: employee.id,
      tin: employee.tin,
      lastName: employee.lastName + (employee.suffix ? ` ${employee.suffix}` : ""),
      firstName: employee.firstName,
      middleName: employee.middleName,
      group: groupOf(employee.employmentType),
      gross: b.gross,
      nonTaxable: s.nonTaxable,
      taxable: s.taxable,
      taxWithheld: b.taxWithheld,
    })
  }
  return rows.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
}

/* ------------------------------------------------------------------ */
/* Leave Monetization                                                  */
/* ------------------------------------------------------------------ */

const DEFAULT_LEAVE_RULES: RatesConfig["leaveMonetization"] = SEED_RATES[SEED_RATES.length - 1]?.leaveMonetization ?? {
  retainedDays: 0,
  maxDaysPerApplication: 0,
}

/** Whole VL days that can be monetized under the rates version's leave rules. */
export function monetizableDays(
  vacationLeave: number,
  rules: RatesConfig["leaveMonetization"] = DEFAULT_LEAVE_RULES
): number {
  return Math.floor(Math.min(rules.maxDaysPerApplication, Math.max(0, vacationLeave - rules.retainedDays)))
}

export interface LeaveMonetizationRow {
  employeeId: string
  employeeNo: string
  name: string
  position: string
  departmentId: string
  vacationLeave: number
  sickLeave: number
  monthlyRate: Centavos
  dailyRate: Centavos
  days: number
  amount: Centavos
  asOf: string
}

export function buildLeaveMonetization(input: {
  employees: readonly Employee[]
  leaveCredits: readonly LeaveCredit[]
  salarySchedules: readonly SalarySchedule[]
  ratesVersions: readonly RatesConfig[]
  date: string
  nameOf: (employee: Employee) => string
}): LeaveMonetizationRow[] {
  const rates = ratesForDate(input.ratesVersions, input.date)
  const credits = new Map(input.leaveCredits.map((c) => [c.employeeId, c]))
  const rows: LeaveMonetizationRow[] = []
  for (const employee of input.employees) {
    if (groupOf(employee.employmentType) !== "plantilla" || employee.status === "separated") continue
    const credit = credits.get(employee.id)
    if (!credit) continue
    const monthlyRate = monthlyRateOn(input, employee, input.date)
    const days = monetizableDays(credit.vacationLeave, rates.leaveMonetization)
    rows.push({
      employeeId: employee.id,
      employeeNo: employee.employeeNo,
      name: input.nameOf(employee),
      position: employee.positionTitle,
      departmentId: employee.departmentId,
      vacationLeave: credit.vacationLeave,
      sickLeave: credit.sickLeave,
      monthlyRate,
      dailyRate: prorate(monthlyRate, 1, rates.workingDaysPerMonth),
      days,
      amount: prorate(monthlyRate, days, rates.workingDaysPerMonth),
      asOf: credit.asOf,
    })
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}
