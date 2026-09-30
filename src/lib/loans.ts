import { addMonths, format, parseISO, subDays } from "date-fns"

import type { Centavos, ISODate, Loan } from "@/types"
import { applyRate, prorate } from "@/lib/payroll/money"

/**
 * Pure helpers for the loans and deductions ledger: add-on interest terms and
 * the monthly amortization schedule.
 */

export type ScheduleStatus = "deducted" | "current" | "scheduled" | "suspended"

export interface AmortizationRow {
  /** First day of the month, `yyyy-MM-01`. */
  month: ISODate
  index: number
  amortization: Centavos
  cumulativePaid: Centavos
  balance: Centavos
  status: ScheduleStatus
}

function monthStart(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`
}

/**
 * Month-by-month amortization schedule from `startPeriod` for `termMonths`.
 * Every month deducts `monthlyAmortization` except the last, which takes the
 * remainder so the schedule adds up to `totalPayable` exactly.
 *
 * Status is relative to `currentMonth`: earlier months are deducted, the
 * current month is current, later months are scheduled. A suspended loan shows
 * suspended from the current month onward. A fully paid loan is all deducted.
 */
export function amortizationSchedule(
  loan: Pick<Loan, "startPeriod" | "termMonths" | "monthlyAmortization" | "totalPayable" | "status">,
  currentMonth: ISODate
): AmortizationRow[] {
  const rows: AmortizationRow[] = []
  const start = parseISO(monthStart(loan.startPeriod))
  const current = monthStart(currentMonth)
  const term = Math.max(0, Math.floor(loan.termMonths))
  let cumulative = 0
  for (let i = 0; i < term; i++) {
    const month = format(addMonths(start, i), "yyyy-MM-dd")
    const isLast = i === term - 1
    const remaining = Math.max(0, loan.totalPayable - cumulative)
    const amortization = isLast ? remaining : Math.min(loan.monthlyAmortization, remaining)
    cumulative += amortization
    let status: ScheduleStatus
    if (loan.status === "fully_paid") status = "deducted"
    else if (month < current) status = "deducted"
    else if (loan.status === "suspended") status = "suspended"
    else status = month === current ? "current" : "scheduled"
    rows.push({
      month,
      index: i + 1,
      amortization,
      cumulativePaid: cumulative,
      balance: loan.totalPayable - cumulative,
      status,
    })
  }
  return rows
}

export interface LoanTerms {
  interest: Centavos
  totalPayable: Centavos
  monthlyAmortization: Centavos
}

/**
 * Add-on interest terms: interest = principal x annual rate x term / 12.
 * Monthly amortization is total payable over the term, rounded to the centavo.
 */
export function loanTerms(principal: Centavos, termMonths: number, annualRatePercent: number): LoanTerms {
  if (principal <= 0 || termMonths <= 0) return { interest: 0, totalPayable: Math.max(0, principal), monthlyAmortization: 0 }
  const annualInterest = applyRate(principal, annualRatePercent / 100)
  const interest = prorate(annualInterest, termMonths, 12)
  const totalPayable = principal + interest
  return { interest, totalPayable, monthlyAmortization: prorate(totalPayable, 1, termMonths) }
}

/** Last day of the final month of a loan that starts on `startMonth`. */
export function loanEndDate(startMonth: ISODate, termMonths: number): ISODate {
  return format(subDays(addMonths(parseISO(monthStart(startMonth)), termMonths), 1), "yyyy-MM-dd")
}

export function loanBalance(loan: Pick<Loan, "totalPayable" | "paidToDate">): Centavos {
  return Math.max(0, loan.totalPayable - loan.paidToDate)
}

/** Share of the total payable already paid, from 0 to 100. */
export function loanProgress(loan: Pick<Loan, "totalPayable" | "paidToDate">): number {
  if (loan.totalPayable <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((loan.paidToDate / loan.totalPayable) * 100)))
}
