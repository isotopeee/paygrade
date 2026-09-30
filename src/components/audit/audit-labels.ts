import type { AuditEntity } from "@/types"

export const ENTITY_LABELS: Record<AuditEntity, string> = {
  employee: "Employee",
  payroll_run: "Payroll run",
  adjustment: "Payroll adjustment",
  salary_schedule: "Salary schedule",
  rates: "Rates and tax tables",
  allowance: "Allowance type",
  department: "Department",
  signatory: "Signatory",
  user: "User account",
  loan: "Loan or deduction",
  remittance: "Remittance",
  dtr: "Time and attendance",
  payslip: "Payslip",
  session: "Session",
  position: "Plantilla position",
  report: "Report",
  audit: "Audit log",
}

export type DateRange = "all" | "7d" | "30d"

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  all: "All time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
}

const DAY_MS = 86_400_000

/**
 * Entries within the range, measured back from the newest entry (or now when
 * the log is empty) so seeded history stays visible in the demo.
 */
export function filterByRange<T extends { at: string }>(entries: readonly T[], range: DateRange, now = Date.now()): T[] {
  if (range === "all") return [...entries]
  let anchor = 0
  for (const e of entries) anchor = Math.max(anchor, Date.parse(e.at))
  if (anchor === 0) anchor = now
  const days = range === "7d" ? 7 : 30
  const from = anchor - days * DAY_MS
  return entries.filter((e) => Date.parse(e.at) >= from)
}

export function changeSummary(before?: string, after?: string): string {
  if (before && after) return `${before} → ${after}`
  return after ?? before ?? ""
}
