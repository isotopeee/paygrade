/**
 * Pure payroll computation functions. No function here reads global state:
 * every rate comes from the `RatesConfig` argument and every amount is integer
 * centavos.
 *
 * Payroll is monthly: one period per calendar month (1st to the last day).
 * Salary, PERA, allowances, contributions, and loan amortizations are taken in
 * full each period, prorated only for days not in service.
 */

import type {
  Adjustment,
  AllowanceType,
  Centavos,
  DtrSummary,
  Employee,
  EmployeeGroup,
  LineItem,
  Loan,
  PayrollLine,
  PayrollPeriod,
  RatesConfig,
  SalarySchedule,
  SpecialPayrollKind,
  TaxBracket,
} from "@/types"
import { groupOf, LOAN_TYPE_LABELS, SPECIAL_KIND_LABELS } from "@/lib/constants"
import { formatDate, registerName } from "@/lib/format"

import { monthsBetween, workingDaysBetween, yearsBetween } from "./calendar"
import { applyRate, clamp, prorate, sum, sumBy } from "./money"
import { REGULAR_PAYROLL_ALLOWANCE_IDS } from "./rates"

/* ------------------------------------------------------------------ */
/* Rate resolution                                                     */
/* ------------------------------------------------------------------ */

/** Monthly basic salary from the salary schedule for a grade and step. */
export function salaryFor(schedule: SalarySchedule, grade: number, step: number): Centavos {
  const row = schedule.matrix[grade - 1]
  const value = row?.[step - 1]
  if (value === undefined) throw new Error(`No salary for SG ${grade} step ${step}`)
  return value
}

/**
 * Monthly rate of an employee. Plantilla uses the salary schedule. COS with a
 * monthly contract uses the contract rate. JO with a daily rate is converted to
 * a monthly equivalent (daily rate times working days per month) for display
 * and for contribution bases.
 */
export function monthlyRateFor(
  employee: Pick<Employee, "rateType" | "salaryGrade" | "step" | "contractRate">,
  schedule: SalarySchedule,
  rates: Pick<RatesConfig, "workingDaysPerMonth">
): Centavos {
  if (employee.rateType === "salary_grade") {
    return salaryFor(schedule, employee.salaryGrade ?? 1, employee.step ?? 1)
  }
  const rate = employee.contractRate ?? 0
  return employee.rateType === "daily" ? rate * rates.workingDaysPerMonth : rate
}

/**
 * The base used for daily and hourly computations. For a monthly rate, the
 * daily rate is `base / workingDaysPerMonth`. For a daily rate, the base is the
 * daily rate itself with a divisor of 1. Keeping base and divisor separate lets
 * every derived amount be rounded exactly once.
 */
export interface RateBasis {
  base: Centavos
  daysDivisor: number
  hoursPerDay: number
}

export function rateBasis(
  employee: Pick<Employee, "rateType" | "contractRate">,
  monthlyRate: Centavos,
  rates: Pick<RatesConfig, "workingDaysPerMonth" | "hoursPerDay">
): RateBasis {
  if (employee.rateType === "daily") {
    return { base: employee.contractRate ?? 0, daysDivisor: 1, hoursPerDay: rates.hoursPerDay }
  }
  return { base: monthlyRate, daysDivisor: rates.workingDaysPerMonth, hoursPerDay: rates.hoursPerDay }
}

export function dailyRate(basis: RateBasis): Centavos {
  return prorate(basis.base, 1, basis.daysDivisor)
}

export function hourlyRate(basis: RateBasis): Centavos {
  return prorate(basis.base, 1, basis.daysDivisor * basis.hoursPerDay)
}

/**
 * Working days an employee is expected to render in a period, accounting for
 * a hire date or separation date that falls inside the period.
 */
export function daysRequiredInPeriod(
  employee: Pick<Employee, "dateHired" | "separationDate">,
  period: Pick<PayrollPeriod, "start" | "end">
): number {
  const start = employee.dateHired > period.start ? employee.dateHired : period.start
  const end =
    employee.separationDate && employee.separationDate < period.end
      ? employee.separationDate
      : period.end
  return workingDaysBetween(start, end)
}

/* ------------------------------------------------------------------ */
/* Earnings                                                            */
/* ------------------------------------------------------------------ */

export interface BasicPayInput {
  group: EmployeeGroup
  basis: RateBasis
  /** Plantilla only: monthly basic salary. */
  monthlyRate: Centavos
  workingDays: number
  daysRequired: number
  absencesWithoutPay: number
  tardinessMinutes: number
  undertimeMinutes: number
}

export interface BasicPayResult {
  scheduled: Centavos
  absences: Centavos
  tardinessUndertime: Centavos
  earned: Centavos
}

/**
 * Basic pay for the period.
 *
 * Plantilla: the monthly salary, prorated by days in service for a partial
 * period (new hire or separation). Absences without pay and
 * tardiness or undertime are deducted at the daily and per-minute rate.
 *
 * JO/COS: no work, no pay. Scheduled pay is the daily rate times days required,
 * less absences and tardiness or undertime.
 */
export function computeBasicPay(input: BasicPayInput): BasicPayResult {
  const { basis } = input
  const scheduled =
    input.group === "plantilla"
      ? input.daysRequired >= input.workingDays
        ? input.monthlyRate
        : prorate(input.monthlyRate, input.daysRequired, input.workingDays)
      : prorate(basis.base, input.daysRequired, basis.daysDivisor)

  const absences = prorate(basis.base, input.absencesWithoutPay, basis.daysDivisor)
  const lateMinutes = input.tardinessMinutes + input.undertimeMinutes
  const tardinessUndertime = prorate(
    basis.base,
    lateMinutes,
    basis.daysDivisor * basis.hoursPerDay * 60
  )
  const earned = Math.max(0, scheduled - absences - tardinessUndertime)
  return { scheduled, absences, tardinessUndertime, earned }
}

/**
 * PERA for the month. Plantilla only. Reduced proportionally for days not in
 * service and for absences without pay.
 */
export function computePera(input: {
  group: EmployeeGroup
  workingDays: number
  daysRequired: number
  absencesWithoutPay: number
  rates: Pick<RatesConfig, "peraMonthly">
}): Centavos {
  if (input.group !== "plantilla" || input.workingDays === 0) return 0
  const paidDays = Math.max(0, input.daysRequired - input.absencesWithoutPay)
  if (paidDays >= input.workingDays) return input.rates.peraMonthly
  return prorate(input.rates.peraMonthly, paidDays, input.workingDays)
}

export function computeOvertime(input: {
  basis: RateBasis
  hoursRegular: number
  hoursRestDay: number
  rates: Pick<RatesConfig, "overtime">
}): Centavos {
  const { basis, rates } = input
  const weightedHours =
    input.hoursRegular * rates.overtime.regularDayMultiplier +
    input.hoursRestDay * rates.overtime.restDayMultiplier
  return prorate(basis.base, weightedHours, basis.daysDivisor * basis.hoursPerDay)
}

export function computeNightDiff(input: {
  basis: RateBasis
  hours: number
  group: EmployeeGroup
  salaryGrade?: number
  rates: Pick<RatesConfig, "nightDiff">
}): Centavos {
  const { rates } = input
  if (input.group !== "plantilla") return 0
  if ((input.salaryGrade ?? 99) > rates.nightDiff.maxSalaryGrade) return 0
  return prorate(
    input.basis.base,
    input.hours * rates.nightDiff.rate,
    input.basis.daysDivisor * input.basis.hoursPerDay
  )
}

/** Monthly longevity pay: 5% of monthly basic for every 5 years of service. */
export function computeLongevityPay(
  monthlyBasic: Centavos,
  yearsOfService: number,
  rates: Pick<RatesConfig, "magnaCarta">
): Centavos {
  const blocks = Math.floor(yearsOfService / rates.magnaCarta.longevityYearsPerBlock)
  if (blocks <= 0) return 0
  return applyRate(monthlyBasic, rates.magnaCarta.longevityRate * blocks)
}

export function hazardRateFor(salaryGrade: number, rates: Pick<RatesConfig, "magnaCarta">): number {
  for (const band of rates.magnaCarta.hazardRates) {
    if (salaryGrade <= band.maxSalaryGrade) return band.rate
  }
  return 0
}

export function computeHazardPay(
  monthlyBasic: Centavos,
  salaryGrade: number,
  daysWorked: number,
  daysRequired: number,
  rates: Pick<RatesConfig, "magnaCarta">
): Centavos {
  if (daysRequired <= 0) return 0
  const full = applyRate(monthlyBasic, hazardRateFor(salaryGrade, rates))
  return daysWorked >= daysRequired ? full : prorate(full, daysWorked, daysRequired)
}

export function computeSubsistenceLaundry(
  daysWorked: number,
  rates: Pick<RatesConfig, "magnaCarta">
): { subsistence: Centavos; laundry: Centavos } {
  const days = Math.min(daysWorked, rates.magnaCarta.subsistenceMaxDays)
  return {
    subsistence: rates.magnaCarta.subsistencePerDay * days,
    laundry: daysWorked > 0 ? rates.magnaCarta.laundryMonthly : 0,
  }
}

/* ------------------------------------------------------------------ */
/* Mandatory contributions                                             */
/* ------------------------------------------------------------------ */

export interface GsisResult {
  personal: Centavos
  government: Centavos
  ecc: Centavos
}

/**
 * GSIS life and retirement premiums on the basic salary actually earned in the
 * period. JO/COS are not GSIS members and pay nothing.
 */
export function computeGsis(
  earnedBasic: Centavos,
  group: EmployeeGroup,
  rates: Pick<RatesConfig, "gsis">
): GsisResult {
  if (group !== "plantilla" || earnedBasic <= 0) return { personal: 0, government: 0, ecc: 0 }
  return {
    personal: applyRate(earnedBasic, rates.gsis.personalRate),
    government: applyRate(earnedBasic, rates.gsis.governmentRate),
    ecc: rates.gsis.eccMonthly,
  }
}

export interface ShareResult {
  employee: Centavos
  government: Centavos
}

/**
 * Monthly PhilHealth premium. The monthly basic is clamped to the floor and
 * ceiling, then multiplied by the premium rate and split between employee and
 * employer. JO/COS pay the employee share only, with no government share.
 */
export function computePhilhealth(
  monthlyBasic: Centavos,
  group: EmployeeGroup,
  rates: Pick<RatesConfig, "philhealth">
): ShareResult {
  if (monthlyBasic <= 0) return { employee: 0, government: 0 }
  const { premiumRate, employeeShare, floor, ceiling } = rates.philhealth
  const premium = applyRate(clamp(monthlyBasic, floor, ceiling), premiumRate)
  const employee = applyRate(premium, employeeShare)
  return { employee, government: group === "plantilla" ? premium - employee : 0 }
}

/**
 * Monthly Pag-IBIG contribution. Compensation is capped at the maximum fund
 * salary. The employee rate is lower at or below the low-income threshold.
 * JO/COS pay the employee share only.
 */
export function computePagibig(
  monthlyCompensation: Centavos,
  group: EmployeeGroup,
  rates: Pick<RatesConfig, "pagibig">
): ShareResult {
  if (monthlyCompensation <= 0) return { employee: 0, government: 0 }
  const p = rates.pagibig
  const base = Math.min(monthlyCompensation, p.maxFundSalary)
  const employeeRate = monthlyCompensation <= p.lowIncomeThreshold ? p.employeeRateLow : p.employeeRate
  return {
    employee: applyRate(base, employeeRate),
    government: group === "plantilla" ? applyRate(base, p.employerRate) : 0,
  }
}

/* ------------------------------------------------------------------ */
/* Withholding tax                                                     */
/* ------------------------------------------------------------------ */

/**
 * Withholding tax for a taxable amount using a graduated table. Returns 0 for
 * zero or negative taxable income.
 */
export function computeWithholdingTax(taxable: Centavos, table: readonly TaxBracket[]): Centavos {
  if (taxable <= 0) return 0
  const bracket = table.find((b) => taxable > b.over && (b.upTo === null || taxable <= b.upTo))
    ?? table[0]
  if (!bracket || bracket.rate === 0) return bracket?.baseTax ?? 0
  return bracket.baseTax + applyRate(taxable - bracket.over, bracket.rate)
}

/**
 * JO/COS are paid as contractors. With a sworn declaration that annual income
 * will not exceed the exemption threshold, nothing is withheld; otherwise a
 * flat rate is withheld on gross pay.
 */
export function computeJoCosWithholding(
  gross: Centavos,
  swornDeclaration: boolean,
  rates: Pick<RatesConfig, "joCos">
): Centavos {
  if (swornDeclaration || gross <= 0) return 0
  return applyRate(gross, rates.joCos.withholdingRate)
}

/* ------------------------------------------------------------------ */
/* Deductions and net                                                  */
/* ------------------------------------------------------------------ */

export function isLoanActiveInPeriod(loan: Loan, periodStart: string): boolean {
  if (loan.status !== "active" && loan.status !== "fully_paid") return false
  return loan.startPeriod <= periodStart && periodStart <= loan.endPeriod
}

/** Monthly loan amortizations due in the period. */
export function computeLoanDeductions(loans: readonly Loan[], periodStart: string): LineItem[] {
  return loans
    .filter((loan) => loan.status !== "suspended" && isLoanActiveInPeriod(loan, periodStart))
    .map((loan) => ({
      code: loan.id,
      label: LOAN_TYPE_LABELS[loan.type],
      amount: loan.monthlyAmortization,
    }))
}

export function computeNet(gross: Centavos, deductions: readonly Centavos[]): {
  totalDeductions: Centavos
  net: Centavos
} {
  const totalDeductions = sum(deductions)
  return { totalDeductions, net: gross - totalDeductions }
}

/** Gross pay: the sum of every earning component. */
export function computeGross(earnings: readonly Centavos[]): Centavos {
  return sum(earnings)
}

/* ------------------------------------------------------------------ */
/* Full payroll line                                                   */
/* ------------------------------------------------------------------ */

export interface PayrollLineContext {
  employee: Employee
  monthlyRate: Centavos
  period: PayrollPeriod
  dtr?: DtrSummary
  loans: readonly Loan[]
  adjustments: readonly Adjustment[]
  allowanceTypes: readonly AllowanceType[]
  rates: RatesConfig
}

export function computePayrollLine(ctx: PayrollLineContext): PayrollLine {
  const { employee, period, rates, monthlyRate } = ctx
  const group = groupOf(employee.employmentType)
  const basis = rateBasis(employee, monthlyRate, rates)
  const flags: string[] = []
  const notes: string[] = []

  const daysRequired = ctx.dtr?.daysRequired ?? daysRequiredInPeriod(employee, period)
  const absencesWithoutPay = ctx.dtr?.absencesWithoutPay ?? 0
  if (!ctx.dtr) flags.push("No DTR on file. Computed as full attendance.")
  if (daysRequired < period.workingDays) {
    if (employee.dateHired > period.start) {
      flags.push(`New hire. Prorated from ${formatDate(employee.dateHired)}.`)
    }
    if (employee.separationDate && employee.separationDate < period.end) {
      flags.push(`Separated on ${formatDate(employee.separationDate)}. Prorated.`)
    }
    notes.push(`Prorated: ${daysRequired} of ${period.workingDays} working days in service.`)
  }

  // Earnings
  const basic = computeBasicPay({
    group,
    basis,
    monthlyRate,
    workingDays: period.workingDays,
    daysRequired,
    absencesWithoutPay,
    tardinessMinutes: ctx.dtr?.tardinessMinutes ?? 0,
    undertimeMinutes: ctx.dtr?.undertimeMinutes ?? 0,
  })
  const pera = computePera({
    group,
    workingDays: period.workingDays,
    daysRequired,
    absencesWithoutPay,
    rates,
  })
  const overtime = computeOvertime({
    basis,
    hoursRegular: ctx.dtr?.overtimeHoursRegular ?? 0,
    hoursRestDay: ctx.dtr?.overtimeHoursRestDay ?? 0,
    rates,
  })
  const nightDiff = computeNightDiff({
    basis,
    hours: ctx.dtr?.nightDiffHours ?? 0,
    group,
    salaryGrade: employee.salaryGrade,
    rates,
  })

  const allowanceFactor = Math.min(1, period.workingDays ? daysRequired / period.workingDays : 0)
  const allowances: (LineItem & { taxable: boolean })[] = []
  if (group === "plantilla") {
    for (const assigned of employee.allowances) {
      const type = ctx.allowanceTypes.find((t) => t.id === assigned.allowanceTypeId)
      if (!type || !type.active) continue
      if (!(REGULAR_PAYROLL_ALLOWANCE_IDS as readonly string[]).includes(type.id)) continue
      const monthly = assigned.amount || type.defaultMonthly
      const amount = allowanceFactor >= 1 ? monthly : prorate(monthly, daysRequired, period.workingDays)
      if (amount > 0) allowances.push({ code: type.code, label: type.name, amount, taxable: type.taxable })
    }
    if (employee.isHealthWorker) {
      const years = yearsBetween(employee.dateHired, period.end)
      const longevity = computeLongevityPay(monthlyRate, years, rates)
      const type = ctx.allowanceTypes.find((t) => t.id === "alw-longevity")
      if (longevity > 0 && type?.active) {
        allowances.push({
          code: type.code,
          label: type.name,
          amount: longevity,
          taxable: type.taxable,
        })
        notes.push(`Longevity pay: ${years} years of service.`)
      }
    }
  }
  const allowancesTotal = sumBy(allowances, (a) => a.amount)

  const employeeAdjustments = ctx.adjustments.filter((a) => a.employeeId === employee.id)
  const otherEarnings: LineItem[] = employeeAdjustments
    .filter((a) => a.kind === "earning")
    .map((a) => ({ code: a.id, label: a.label, amount: a.amount }))
  const otherEarningsTotal = sumBy(otherEarnings, (e) => e.amount)

  const gross = computeGross([basic.earned, pera, allowancesTotal, overtime, nightDiff, otherEarningsTotal])

  // Contributions
  const gsis = computeGsis(basic.earned, group, rates)
  const monthlyForContrib = group === "plantilla" ? monthlyRate : basic.earned
  const phMonthly = computePhilhealth(monthlyForContrib, group, rates)
  const piMonthly = computePagibig(monthlyForContrib, group, rates)
  const hasEarnings = basic.earned > 0
  const philhealth = hasEarnings ? phMonthly.employee : 0
  const philhealthGovernment = hasEarnings ? phMonthly.government : 0
  const pagibig = hasEarnings ? piMonthly.employee : 0
  const pagibigGovernment = hasEarnings ? piMonthly.government : 0

  // Withholding tax
  const taxableEarnings =
    basic.earned +
    sumBy(allowances.filter((a) => a.taxable), (a) => a.amount) +
    overtime +
    nightDiff +
    otherEarningsTotal
  const taxableIncome = Math.max(0, taxableEarnings - gsis.personal - philhealth - pagibig)
  const withholdingTax =
    group === "plantilla"
      ? computeWithholdingTax(taxableIncome, rates.withholding.monthly)
      : computeJoCosWithholding(gross, employee.swornDeclaration ?? false, rates)
  if (group === "jo_cos") {
    notes.push(
      employee.swornDeclaration
        ? "Sworn declaration on file. No tax withheld."
        : "No sworn declaration. Flat withholding on gross."
    )
  }

  // Loans and other deductions
  const loans = computeLoanDeductions(ctx.loans, period.start)
  const loansTotal = sumBy(loans, (l) => l.amount)
  const otherDeductions: LineItem[] = employeeAdjustments
    .filter((a) => a.kind === "deduction")
    .map((a) => ({ code: a.id, label: a.label, amount: a.amount }))
  const otherDeductionsTotal = sumBy(otherDeductions, (d) => d.amount)

  const { totalDeductions, net } = computeNet(gross, [
    gsis.personal,
    philhealth,
    pagibig,
    withholdingTax,
    loansTotal,
    otherDeductionsTotal,
  ])

  if (hasEarnings && net < rates.minimumNetPayMonthly) {
    flags.push("Net pay is below the minimum take-home pay under the GAA.")
  }
  if (employeeAdjustments.length > 0) {
    flags.push(`${employeeAdjustments.length} manual adjustment${employeeAdjustments.length > 1 ? "s" : ""}.`)
  }

  return {
    employeeId: employee.id,
    employeeNo: employee.employeeNo,
    employeeName: registerName(employee),
    departmentId: employee.departmentId,
    positionTitle: employee.positionTitle,
    group,
    monthlyRate,
    basicScheduled: basic.scheduled,
    tardinessUndertime: basic.tardinessUndertime,
    absences: basic.absences,
    basic: basic.earned,
    pera,
    allowances: allowances.map(({ code, label, amount }) => ({ code, label, amount })),
    allowancesTotal,
    overtime,
    nightDiff,
    otherEarnings,
    gross,
    taxableIncome,
    gsis: gsis.personal,
    gsisGovernment: gsis.government,
    ecc: gsis.ecc,
    philhealth,
    philhealthGovernment,
    pagibig,
    pagibigGovernment,
    withholdingTax,
    loans,
    loansTotal,
    otherDeductions,
    otherDeductionsTotal,
    totalDeductions,
    net,
    flags,
    notes,
  }
}

/* ------------------------------------------------------------------ */
/* Special payroll                                                     */
/* ------------------------------------------------------------------ */

export interface SpecialLineContext {
  kind: SpecialPayrollKind
  employee: Employee
  monthlyRate: Centavos
  /** Reference date for eligibility, for example May 15 for the Mid-Year Bonus. */
  asOf: string
  /** Days worked and required in the covered month (hazard, subsistence). */
  daysWorked: number
  daysRequired: number
  adjustments: readonly Adjustment[]
  rates: RatesConfig
}

export function isEligibleForSpecial(
  kind: SpecialPayrollKind,
  employee: Employee,
  asOf: string,
  rates: Pick<RatesConfig, "bonuses">
): { eligible: boolean; reason?: string } {
  if (groupOf(employee.employmentType) !== "plantilla") {
    return { eligible: false, reason: "JO/COS workers are not covered." }
  }
  if (employee.status === "separated" && (employee.separationDate ?? "") < asOf) {
    return { eligible: false, reason: "Separated before the reference date." }
  }
  if (employee.dateHired > asOf) {
    return { eligible: false, reason: "Hired after the reference date." }
  }
  if (kind === "hazard_pay" || kind === "subsistence_laundry") {
    return employee.isHealthWorker
      ? { eligible: true }
      : { eligible: false, reason: "Not a public health worker under RA 7305." }
  }
  if (kind === "mid_year_bonus" || kind === "year_end_bonus" || kind === "pei") {
    const months = monthsBetween(employee.dateHired, asOf)
    if (months < rates.bonuses.minimumMonthsForBonus) {
      return {
        eligible: false,
        reason: `Less than ${rates.bonuses.minimumMonthsForBonus} months of service as of ${formatDate(asOf)}.`,
      }
    }
  }
  return { eligible: true }
}

export function computeSpecialLine(ctx: SpecialLineContext): PayrollLine {
  const { kind, employee, rates, monthlyRate } = ctx
  const earnings: LineItem[] = []
  const notes: string[] = []

  switch (kind) {
    case "mid_year_bonus":
      earnings.push({ code: "MYB", label: "Mid-Year Bonus", amount: monthlyRate })
      notes.push(`One month basic salary as of ${formatDate(ctx.asOf)}.`)
      break
    case "year_end_bonus":
      earnings.push({ code: "YEB", label: "Year-End Bonus", amount: monthlyRate })
      earnings.push({ code: "CG", label: "Cash Gift", amount: rates.bonuses.cashGift })
      notes.push(`One month basic salary as of ${formatDate(ctx.asOf)} plus cash gift.`)
      break
    case "pei":
      earnings.push({ code: "PEI", label: "Productivity Enhancement Incentive", amount: rates.bonuses.pei })
      break
    case "hazard_pay": {
      const grade = employee.salaryGrade ?? 1
      const amount = computeHazardPay(monthlyRate, grade, ctx.daysWorked, ctx.daysRequired, rates)
      earnings.push({ code: "HP", label: "Hazard Pay", amount })
      notes.push(
        `${(hazardRateFor(grade, rates) * 100).toFixed(0)}% of monthly basic for SG ${grade}, ${ctx.daysWorked} of ${ctx.daysRequired} days.`
      )
      break
    }
    case "subsistence_laundry": {
      const { subsistence, laundry } = computeSubsistenceLaundry(ctx.daysWorked, rates)
      earnings.push({ code: "SA", label: "Subsistence Allowance", amount: subsistence })
      earnings.push({ code: "LA", label: "Laundry Allowance", amount: laundry })
      notes.push(`Subsistence for ${Math.min(ctx.daysWorked, rates.magnaCarta.subsistenceMaxDays)} days worked.`)
      break
    }
    case "uniform_allowance":
      earnings.push({ code: "UA", label: "Uniform Allowance", amount: rates.bonuses.uniformAllowance })
      break
  }

  const employeeAdjustments = ctx.adjustments.filter((a) => a.employeeId === employee.id)
  const otherEarnings = employeeAdjustments
    .filter((a) => a.kind === "earning")
    .map((a) => ({ code: a.id, label: a.label, amount: a.amount }))
  const otherDeductions = employeeAdjustments
    .filter((a) => a.kind === "deduction")
    .map((a) => ({ code: a.id, label: a.label, amount: a.amount }))

  const allowancesTotal = sumBy(earnings, (e) => e.amount)
  const otherEarningsTotal = sumBy(otherEarnings, (e) => e.amount)
  const otherDeductionsTotal = sumBy(otherDeductions, (d) => d.amount)
  const gross = computeGross([allowancesTotal, otherEarningsTotal])
  const { totalDeductions, net } = computeNet(gross, [otherDeductionsTotal])
  notes.push("Tax on benefits above the annual exemption ceiling is settled at year-end annualization.")

  return {
    employeeId: employee.id,
    employeeNo: employee.employeeNo,
    employeeName: registerName(employee),
    departmentId: employee.departmentId,
    positionTitle: employee.positionTitle,
    group: groupOf(employee.employmentType),
    monthlyRate,
    basicScheduled: 0,
    tardinessUndertime: 0,
    absences: 0,
    basic: 0,
    pera: 0,
    allowances: earnings,
    allowancesTotal,
    overtime: 0,
    nightDiff: 0,
    otherEarnings,
    gross,
    taxableIncome: 0,
    gsis: 0,
    gsisGovernment: 0,
    ecc: 0,
    philhealth: 0,
    philhealthGovernment: 0,
    pagibig: 0,
    pagibigGovernment: 0,
    withholdingTax: 0,
    loans: [],
    loansTotal: 0,
    otherDeductions,
    otherDeductionsTotal,
    totalDeductions,
    net,
    flags: employeeAdjustments.length ? [`${employeeAdjustments.length} manual adjustment(s).`] : [],
    notes,
  }
}

export function specialTitle(kind: SpecialPayrollKind): string {
  return SPECIAL_KIND_LABELS[kind]
}
